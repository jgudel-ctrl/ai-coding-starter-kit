# PROJ-24: Architektur — Easybill Partner-Sync via Webhook

> Status: 🟡 In Review  
> Letzte Änderung: 2026-07-09  
> Verantwortlich: Jan Bernd Gudel / Klausi

---

## Übersicht

**Was wir bauen:**
Einen bidirektionalen Sync zwischen Easybill (externes Rechnungs-System) und unserem TMS (Superbays). Easybill ruft uns via Webhook an wenn sich ein Kunde ändert. Wir verarbeiten das und aktualisieren unsere Datenbank.

**Architektur-Prinzipien:**
- **Idempotent:** Gleicher Webhook mehrfach = kein Schaden
- **Soft-Delete:** Nie physisch löschen, nur deaktivieren
- **Audit-Trail:** Jeder Sync wird geloggt
- **Fallback:** Webhook + Cronjob = doppelte Sicherheit

---

## Technischer Stack

| Komponente | Technologie | Warum |
|------------|-------------|-------|
| **Frontend** | Next.js 14 (App Router) | Server Actions, API Routes |
| **Backend** | Next.js API Routes | Webhook-Handler |
| **Datenbank** | PostgreSQL (Supabase) | Relationale Daten, JSONB für Rohdaten |
| **ORM/Client** | Supabase JS Client | Service-Role für Admin/Sync |
| **Scheduler** | OpenClaw Cron | Stündlicher Fallback-Cronjob |
| **Adress-Validierung** | Geoapify API | Free-Tier, 3.000 Credits/Tag |
| **Externe API** | Easybill REST API | Kunden, Adressen, Rabatte |

---

## Datenbank-Schema (Migrationen)

### Neue Tabellen

#### 1. `partner_discounts`

```sql
CREATE TABLE tms.partner_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES tms.partners(id) ON DELETE CASCADE,
  easybill_discount_id BIGINT,
  position_group_id BIGINT NOT NULL,
  position_group_name TEXT,
  position_group_number TEXT,
  discount_percent NUMERIC(5,2),
  discount_type TEXT DEFAULT 'PERCENT', -- 'PERCENT' oder 'AMOUNT'
  raw_easybill_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(partner_id, position_group_id)
);

CREATE INDEX idx_partner_discounts_partner ON tms.partner_discounts(partner_id);
CREATE INDEX idx_partner_discounts_group ON tms.partner_discounts(position_group_id);
```

#### 2. `position_groups`

```sql
CREATE TABLE tms.position_groups (
  id BIGINT PRIMARY KEY, -- Easybill ID als PK
  name TEXT,
  display_name TEXT,
  number TEXT,
  description TEXT,
  raw_easybill_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_position_groups_number ON tms.position_groups(number);
```

#### 3. `customer_groups`

```sql
CREATE TABLE tms.customer_groups (
  id BIGINT PRIMARY KEY, -- Easybill ID als PK
  name TEXT,
  display_name TEXT,
  number TEXT,
  description TEXT,
  raw_easybill_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_groups_number ON tms.customer_groups(number);
```

### Erweiterungen bestehender Tabellen

#### `tms.partners`

```sql
-- Neue Felder für Dubletten-Erkennung
ALTER TABLE tms.partners 
ADD COLUMN duplicate_of UUID REFERENCES tms.partners(id),
ADD COLUMN duplicate_reason TEXT;

-- Index für Dubletten-Suche
CREATE INDEX idx_partners_duplicate ON tms.partners(duplicate_of) WHERE duplicate_of IS NOT NULL;
```

#### `partner_addresses`

```sql
-- Soft-Delete Felder (falls nicht vorhanden)
ALTER TABLE tms.partner_addresses 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Constraint: Nur eine aktive Rechnungsadresse pro Partner
-- Wird in Application-Logik umgesetzt, nicht DB-Constraint (wegen Flexibilität)
```

#### `partner_contacts`

```sql
-- Soft-Delete Felder (falls nicht vorhanden)
ALTER TABLE tms.partner_contacts 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

---

## API-Endpunkte

### 1. Webhook-Endpoint (Empfang)

**Route:** `POST /api/webhooks/easybill/customer`  
**Body:** JSON (Easybill Customer Payload)  
**Headers:**
- `Authorization: Bearer {WEBHOOK_SECRET}`
- `X-Easybill-Event: customer.created | customer.updated`

**Ablauf:**
```
1. Authentifizierung prüfen (Webhook-Secret)
2. Event-Type bestimmen (created vs updated)
3. JSON Body parsen
4. Sync-Funktion aufrufen
5. Ergebnis loggen
6. HTTP 200 zurückgeben (sonst retried Easybill)
```

**Fehlerbehandlung:**
- HTTP 200 = Alles OK (auch wenn nichts geändert)
- HTTP 400 = Bad Request (ungültiges JSON)
- HTTP 401 = Unauthorized (falscher Secret)
- HTTP 500 = Server Error → Easybill retried später

### 2. Sync-Funktion (Intern)

**Funktion:** `syncEasybillCustomer(easybillCustomer: EasybillCustomer)`  
**Rückgabe:** `{ success: boolean, partnerId?: UUID, actions: string[], errors?: string[] }`

**Schritte:**
```
1. easybill_customer_number extrahieren
2. Prüfen: Existiert Partner schon?
   - JA → updatePartner()
   - NEIN → createPartner()
3. Adressen synchronisieren
4. Kontakte synchronisieren
5. Billing-Einstellungen synchronisieren
6. Rabatte synchronisieren
7. Nach-Sync: Rechnungen verknüpfen
8. Dubletten-Prüfung (nur bei NEU)
9. Ergebnis loggen
```

### 3. Cronjob-Endpoint (Auslösung)

**Route:** `GET /api/cron/sync-easybill-customers` (oder interner Handler)  
**Trigger:** Stündlich via OpenClaw Cron  
**Logik:**
```
1. Letzten Sync-Zeitpunkt aus easybill_sync_logs holen
2. Easybill API: Alle Kunden seit diesem Zeitpunkt abrufen
3. Für jeden Kunden: syncEasybillCustomer() aufrufen
4. Ergebnis loggen
```

---

## Sync-Logik im Detail

### createPartner() — Neuer Kunde

```typescript
async function createPartner(easybillCustomer: EasybillCustomer): Promise<SyncResult> {
  // 1. Prüfen: Existiert schon? (Race Condition)
  const existing = await findPartnerByEasybillNumber(easybillCustomer.number);
  if (existing) {
    return updatePartner(easybillCustomer);
  }
  
  // 2. Display Name generieren (Regel Ü1)
  const displayName = easybillCustomer.company_name 
    || `${easybillCustomer.first_name} ${easybillCustomer.last_name}`
    || 'Unbekannt';
  
  // 3. Partner anlegen
  const partner = await supabase
    .from('partners')
    .insert({
      easybill_id: easybillCustomer.id,
      easybill_customer_number: easybillCustomer.number,
      partner_type: 'customer',
      entity_type: easybillCustomer.company_name ? 'company' : 'person',
      company_name: easybillCustomer.company_name,
      first_name: easybillCustomer.first_name,
      last_name: easybillCustomer.last_name,
      display_name: displayName,
      email: easybillCustomer.emails?.[0]?.email,
      phone: easybillCustomer.phone,
      mobile: easybillCustomer.mobile,
      vat_identifier: easybillCustomer.vat_identifier,
      tax_number: easybillCustomer.tax_number,
      easybill_group_id: easybillCustomer.group_id,
      is_active: !easybillCustomer.archived, // Regel Ü2
      source_system: 'easybill',
      raw_easybill_payload: easybillCustomer,
      easybill_created_at: easybillCustomer.created_at,
      easybill_updated_at: easybillCustomer.updated_at,
    })
    .select()
    .single();
  
  // 4. Adressen synchronisieren
  await syncAddresses(partner.id, easybillCustomer);
  
  // 5. Kontakte synchronisieren
  await syncContacts(partner.id, easybillCustomer);
  
  // 6. Billing synchronisieren
  await syncBillingSettings(partner.id, easybillCustomer);
  
  // 7. Rabatte synchronisieren
  await syncDiscounts(partner.id, easybillCustomer.id);
  
  // 8. Nach-Sync: Rechnungen verknüpfen
  await linkOrphanedInvoices(partner.id, easybillCustomer.number);
  
  // 9. Dubletten-Prüfung (Regel Ü3)
  await checkForDuplicates(partner.id);
  
  return { success: true, partnerId: partner.id, actions: ['created'] };
}
```

### syncAddresses() — Adressen

```typescript
async function syncAddresses(partnerId: UUID, customer: EasybillCustomer) {
  // 1. Rechnungsadresse anlegen
  const billingAddress = customer.address;
  await supabase.from('partner_addresses').insert({
    partner_id: partnerId,
    address_type: 'billing',
    is_primary: true,
    company_name: billingAddress.company_name,
    first_name: billingAddress.first_name,
    last_name: billingAddress.last_name,
    street: `${billingAddress.street} ${billingAddress.number}`,
    postal_code: billingAddress.zip_code,
    city: billingAddress.city,
    country: billingAddress.country,
    raw_easybill_payload: billingAddress,
  });
  
  // 2. Lieferadresse prüfen
  const shippingAddress = customer.delivery_address || billingAddress;
  await supabase.from('partner_addresses').insert({
    partner_id: partnerId,
    address_type: 'shipping',
    is_primary: false,
    // ... gleiche Felder wie Rechnungsadresse
  });
  
  // 3. Geoapify-Validierung (nur Lieferadresse)
  await validateAddressWithGeoapify(shippingAddress);
}
```

### syncDiscounts() — Rabatte

```typescript
async function syncDiscounts(partnerId: UUID, easybillCustomerId: number) {
  // 1. Produktgruppen aktualisieren (Referenz)
  const positionGroups = await easybillApi.getPositionGroups();
  for (const group of positionGroups) {
    await supabase.from('position_groups').upsert({
      id: group.id,
      name: group.name,
      display_name: group.display_name,
      number: group.number,
      description: group.description,
      raw_easybill_payload: group,
      updated_at: new Date(),
    });
  }
  
  // 2. Kundengruppen aktualisieren (Referenz)
  const customerGroups = await easybillApi.getCustomerGroups();
  // ... gleiche Logik
  
  // 3. Alte Rabatte löschen (Voll-Replace)
  await supabase.from('partner_discounts')
    .delete()
    .eq('partner_id', partnerId);
  
  // 4. Neue Rabatte importieren
  const discounts = await easybillApi.getDiscounts({ customer_id: easybillCustomerId });
  for (const discount of discounts) {
    const group = positionGroups.find(g => g.id === discount.position_group_id);
    await supabase.from('partner_discounts').insert({
      partner_id: partnerId,
      easybill_discount_id: discount.id,
      position_group_id: discount.position_group_id,
      position_group_name: group?.name,
      position_group_number: group?.number,
      discount_percent: discount.discount,
      discount_type: discount.discount_type,
      raw_easybill_payload: discount,
    });
  }
}
```

### checkForDuplicates() — Dubletten-Prüfung

```typescript
async function checkForDuplicates(partnerId: UUID) {
  const partner = await getPartner(partnerId);
  
  // 1. Suche nach gleichem Namen
  const candidates = await supabase
    .from('partners')
    .select('id, display_name, easybill_customer_number')
    .or(`display_name.eq.${partner.display_name},company_name.eq.${partner.company_name}`)
    .neq('id', partnerId)
    .is('duplicate_of', null); // Nur aktive Dubletten
  
  // 2. Für jeden Kandidaten: Adressen vergleichen
  for (const candidate of candidates) {
    const sameBilling = await compareBillingAddress(partnerId, candidate.id);
    const sameShipping = await compareShippingAddress(partnerId, candidate.id);
    
    if (sameBilling || sameShipping) {
      // 3. Umsatz vergleichen
      const partnerRevenue = await getPartnerRevenue(partnerId);
      const candidateRevenue = await getPartnerRevenue(candidate.id);
      
      // 4. Weniger Umsatz = Dublette
      const [main, duplicate] = partnerRevenue >= candidateRevenue 
        ? [partner, candidate] 
        : [candidate, partner];
      
      await supabase.from('partners').update({
        is_active: false,
        duplicate_of: main.id,
        duplicate_reason: `Auto-detected: Same name/address. Revenue: ${partnerRevenue} vs ${candidateRevenue}`,
      }).eq('id', duplicate.id);
    }
  }
}
```

---

## Cronjob-Konfiguration

### Stündlicher Fallback-Cronjob

```json
{
  "name": "Easybill Partner Sync Fallback",
  "schedule": { "kind": "cron", "expr": "0 * * * *" },
  "payload": {
    "kind": "systemEvent",
    "text": "Easybill Partner Sync: Stündlicher Fallback-Cronjob. Holt alle Kunden seit letztem Lauf."
  },
  "sessionTarget": "main"
}
```

**Logik:**
```
1. Letzten Sync-Zeitpunkt aus easybill_sync_logs holen
   (MAX(synced_at) WHERE sync_type = 'customer')
   
2. Falls kein letzter Sync: 24h zurück

3. Easybill API abfragen:
   GET /customers?updated_at_min={lastSyncTime}
   
4. Für jeden Kunden:
   - syncEasybillCustomer() aufrufen
   - Ergebnis in easybill_sync_logs eintragen
   
5. Zusammenfassung loggen:
   "Sync abgeschlossen: 5 neue, 3 aktualisiert, 0 Fehler"
```

---

## Fehlerbehandlung & Logging

### easybill_sync_logs (Erweitert)

```sql
ALTER TABLE tms.easybill_sync_logs 
ADD COLUMN IF NOT EXISTS sync_type TEXT DEFAULT 'customer', -- 'customer', 'invoice', 'discount'
ADD COLUMN IF NOT EXISTS entity_type TEXT, -- 'partner', 'address', 'contact'
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
```

**Log-Einträge:**

| sync_type | easybill_id | partner_id | status | details |
|-----------|-------------|------------|--------|---------|
| customer | 687795862 | abc-123 | success | created, addresses: 2, contacts: 1 |
| customer | 687795862 | abc-123 | success | updated, discounts: 5 |
| customer | 999999999 | null | error | No email found for contact |
| customer | 888888888 | def-456 | warning | duplicate_detected, deactivated |

### Retry-Logik

```
- Fehler → retry_count + 1
- Max. 3 Retries
- Bei Erfolg: retry_count = 0
- Bei max. Retries erreicht: Status = 'failed', Admin-Benachrichtigung
```

---

## Testplan

### Unit Tests

| Test | Erwartetes Ergebnis |
|------|-------------------|
| `display_name` mit Firmenname | "Musterfirma GmbH" |
| `display_name` ohne Firma | "Max Mustermann" |
| Dublette gleicher Name + Adresse | Umsatzschwächerer Partner deaktiviert |
| Keine Lieferadresse in Easybill | Rechnungsadresse wird kopiert |
| Kein Kontakt mit E-Mail | Kunde wird abgelehnt |
| Archivierter Easybill-Kunde | `is_active = false` |

### Integration Tests

| Test | Erwartetes Ergebnis |
|------|-------------------|
| Webhook `customer.created` | Partner + Adressen + Kontakte in DB |
| Webhook `customer.updated` | Bestehende Daten aktualisiert |
| Geoapify ungültige Adresse | `geoapify_validation_status = 'invalid'` |
| Cronjob stündlich | Nur geänderte Kunden seit letztem Lauf |
| Nach-Sync Rechnungen | `partner_id` wird nachgetragen |

### End-to-End Test

1. **Neuen Kunden in Easybill anlegen**
2. **Webhook empfangen** → Partner in DB prüfen
3. **Adressen prüfen** → Geoapify-Validierung OK?
4. **Kontakt prüfen** → E-Mail vorhanden?
5. **Rabatte prüfen** → Produktgruppen korrekt?
6. **Rechnung anlegen** in Easybill
7. **Rechnungssync** → `partner_id` verknüpft?

---

## Sicherheit

### Webhook-Authentifizierung

```
1. Header "Authorization: Bearer {WEBHOOK_SECRET}" prüfen
2. WEBHOOK_SECRET = Umgebungsvariable (nicht im Code)
3. Falsches Secret → HTTP 401
4. Kein Secret → HTTP 401
```

### IP-Whitelist (Optional)

Easybill sendet Webhooks von festen IPs. Wir können diese whitelisten:
- Prüfen: `X-Forwarded-For` oder `remoteAddress`
- Falls nicht von Easybill-IP → HTTP 403

### HTTPS Erzwungen

- Webhook-Endpoint nur via HTTPS erreichbar
- HTTP-Requests werden auf HTTPS umgeleitet

---

## Deployment-Plan

1. **Migrationen ausführen** (neue Tabellen + Felder)
2. **Geoapify API-Key** in `.env.production` eintragen
3. **Webhook-Secret** generieren und in `.env.production` eintragen
4. **Cronjob** registrieren (OpenClaw)
5. **Easybill Webhook** in Easybill-UI konfigurieren
6. **Test:** Einen Kunden in Easybill anlegen → TMS prüfen

---

## Offene Punkte

| # | Punkt | Status |
|---|-------|--------|
| 1 | Easybill Webhook-Secret generieren | ❌ Offen |
| 2 | Webhook-URL in Easybill konfigurieren | ❌ Offen |
| 3 | Initialer Import der 67 fehlenden Kunden | ❌ Offen |

---

## Nächste Schritte

1. **Jan Bernd:** Architektur review + "approved"
2. **Klausi:** Tabellen anlegen (Migrationen)
3. **Klausi:** Webhook-Endpoint implementieren
4. **Klausi:** Sync-Logik implementieren
5. **Klausi:** Cronjob einrichten
6. **Gemeinsam:** Easybill Webhook konfigurieren + Testen
