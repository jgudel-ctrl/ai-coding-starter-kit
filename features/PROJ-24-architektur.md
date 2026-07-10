# PROJ-24: Architektur — Easybill Partner-Sync

> Status: 🟠 In Review | 2026-07-10 08:45 UTC  
> Verantwortlich: Klausi  
> Basis: PROJ-24 Spec (approved)

---

## Übersicht

Dieses Dokument beschreibt die technische Architektur für den Easybill Partner-Sync.

**Was gebaut wird:**
1. Initial-Import der 67 fehlenden Kunden aus Easybill
2. Stündlicher Fallback-Cronjob
3. Geoapify-Adressvalidierung

**Wichtige Entscheidungen:**
- Admin-Client mit Service-Role-Key (umgeht RLS)
- Schema `tms` für alle DB-Operationen
- Voll-Replace bei Adressen/Kontakten (nicht Delta-Sync)
- Dubletten-Prüfung nach jedem Import

---

## Technische Komponenten

### 1. Initial-Import Script

**Datei:** `scripts/import-easybill-partners.ts`

**Ablauf:**
```
1. Alle aktiven Easybill-Kunden abrufen (GET /customers)
   → Paginierung: 1000 pro Request
2. Für jeden Kunden:
   a) Prüfen: Existiert easybill_customer_number in DB?
   b) Falls NEIN → syncEasybillCustomer() aufrufen
   c) Fehler loggen
3. Ergebnis zusammenfassen
```

**Easybill API:**
- Endpoint: `GET https://api.easybill.de/rest/v1/customers`
- Header: `Authorization: Bearer {EASYBILL_API_KEY}`
- Paginierung: `?page=1&limit=1000`

**Datenbank-Operationen (Admin-Client):**
- Schema: `tms`
- Tabellen: `partners`, `partner_addresses`, `partner_contacts`, `partner_billing_settings`
- Dubletten-Prüfung nach jedem Insert

### 2. Cronjob (Fallback)

**Datei:** `scripts/cron-easybill-sync.ts`

**Trigger:** Stündlich (z.B. :05 nach jeder Stunde)

**Ablauf:**
```
1. Letzte Sync-Zeit aus easybill_sync_logs holen
2. Easybill-Kunden abrufen, die seitdem geändert wurden
   → Filter: ?updated_at[gte]={lastSync}
3. Gleiche Sync-Logik wie Initial-Import
4. Ergebnis loggen
```

**Logging:**
- Tabelle: `easybill_sync_logs`
- Felder: partner_id, action, status, error, created_at

### 3. Geoapify-Adressvalidierung

**Datei:** `src/lib/geoapify/validate-address.ts`

**API:**
- Endpoint: `GET https://api.geoapify.com/v1/geocode/search`
- Parameter: `?text={address}&apiKey=***}`
- Free-Tier: 3.000 Credits/Tag

**Ablauf:**
```
1. Nach Adress-Sync: Adresse zusammensetzen
   → "{street} {number}, {postal_code} {city}"
2. An Geoapify senden
3. Ergebnis in partner_addresses speichern (Original bleibt erhalten):
   - geoapify_validation_status: 'valid' | 'invalid' | 'error'
   - geoapify_lat: Latitude
   - geoapify_lon: Longitude
   - geoapify_formatted: Korrigierte Adresse (nur als Hinweis)
```

**Wichtig:** Original-Adresse wird NICHT überschrieben. Geoapify-Daten sind nur ergänzende Information.

**Rate Limiting:**
- Max. 5 Requests/Sekunde
- Wir machen 1 Request pro Adresse (seriell)

---

## Datenfluss

```
Easybill API
    ↓ (HTTP GET)
Import-Script / Cronjob
    ↓
syncEasybillCustomer()
    ↓
Supabase Admin-Client (Schema: tms)
    ↓
partners (INSERT/UPDATE)
    ↓
partner_addresses (INSERT)
    ↓
partner_contacts (INSERT)
    ↓
partner_billing_settings (INSERT)
    ↓
checkForDuplicates()
    ↓
partner_addresses (Geoapify UPDATE)
    ↓
easybill_sync_logs (INSERT)
```

---

## Datenbank-Schema (wichtige Felder)

### partners
- id: UUID (PK)
- easybill_id: BIGINT
- easybill_customer_number: TEXT (UNIQUE)
- company_name: TEXT
- first_name: TEXT
- last_name: TEXT
- display_name: TEXT
- email: TEXT
- phone: TEXT
- mobile: TEXT
- vat_identifier: TEXT
- tax_number: TEXT
- easybill_group_id: BIGINT
- is_active: BOOLEAN
- is_archived: BOOLEAN
- duplicate_of: UUID → partners.id
- duplicate_reason: TEXT
- source_system: TEXT
- raw_easybill_payload: JSONB
- easybill_created_at: TIMESTAMPTZ
- easybill_updated_at: TIMESTAMPTZ

### partner_addresses
- id: UUID (PK)
- partner_id: UUID → partners.id
- address_type: TEXT ('billing' | 'shipping')
- company_name: TEXT
- first_name: TEXT
- last_name: TEXT
- street: TEXT
- postal_code: TEXT
- city: TEXT
- country: TEXT
- is_primary: BOOLEAN
- is_active: BOOLEAN
- geoapify_validation_status: TEXT
- geoapify_lat: NUMERIC
- geoapify_lon: NUMERIC
- geoapify_formatted: TEXT
- raw_easybill_payload: JSONB

### partner_contacts
- id: UUID (PK)
- partner_id: UUID → partners.id
- first_name: TEXT
- last_name: TEXT
- display_name: TEXT
- email: TEXT
- phone: TEXT
- mobile: TEXT
- is_primary: BOOLEAN
- is_invoice_recipient: BOOLEAN
- is_active: BOOLEAN

### partner_billing_settings
- id: UUID (PK)
- partner_id: UUID → partners.id
- payment_terms_days: INTEGER
- cash_discount_percent: NUMERIC
- cash_discount_days: INTEGER
- sepa_mandate_reference: TEXT
- sepa_mandate_date: DATE
- iban_last4: TEXT
- bic: TEXT
- default_invoice_email: TEXT
- buyer_reference: TEXT
- vat_identifier: TEXT
- tax_number: TEXT
- raw_easybill_payload: JSONB

### easybill_sync_logs
- id: UUID (PK)
- partner_id: UUID → partners.id
- easybill_customer_id: BIGINT
- action: TEXT ('create' | 'update' | 'import')
- status: TEXT ('success' | 'error' | 'skipped')
- message: TEXT
- error_details: TEXT
- created_at: TIMESTAMPTZ

---

## Fehlerbehandlung

### Wenn Easybill API nicht erreichbar
- Retry: 3x mit Exponential Backoff (1s, 2s, 4s)
- Falls weiterhin fehlgeschlagen: Fehler loggen, nächsten Kunden verarbeiten

### Wenn Adresse ungültig (Geoapify)
- Status: 'invalid'
- Kein Fehler — Kunde wird trotzdem importiert
- Adresse wird markiert für manuelle Prüfung

### Wenn Dublette erkannt
- Weniger umsatzstarker Partner: is_active = false
- Beide Partner bleiben in DB
- Admin kann später manuell prüfen

### Wenn Keine E-Mail vorhanden
- Kunde wird abgelehnt
- Fehler wird in easybill_sync_logs geloggt
- Admin muss manuell nacharbeiten

---

## Sicherheit

- Supabase Service-Role-Key (umgeht RLS)
- HTTPS für alle API-Calls
- Easybill API-Key aus .env.production
- Keine Credentials im Code

---

## Performance-Schätzungen

### Initial-Import (67 Kunden)
- Easybill API: 1 Request (67 Kunden passen in 1 Page)
- Supabase INSERTs: ~67 × 4 Tabellen = ~268 INSERTs
- Geoapify: ~134 Adressen × 1 Request = ~134 Requests
- **Gesamtzeit:** ~2–3 Minuten

### Cronjob (stündlich)
- Nur geänderte Kunden (typisch 0–5 pro Stunde)
- **Gesamtzeit:** < 10 Sekunden

---

## Testplan

1. **Test mit 1 Kunde:**
   - Script auf 1 Kunde limitieren
   - Prüfen: Partner + Adressen + Kontakte vorhanden?
   - Dublette-Prüfung läuft?
   - Geoapify-Ergebnis vorhanden?

2. **Test mit allen 67:**
   - Vollständiger Import
   - Ergebnis: Wie viele erfolgreich, Fehler, Dubletten?

3. **Cronjob-Test:**
   - Manuell ausführen
   - Prüfen: Nur geänderte Kunden werden verarbeitet?

---

## Entscheidungen (beantwortet)

- [x] Geoapify: Original-Adresse bleibt erhalten (nur Hinweis)
- [x] Dubletten: Nicht im Admin-Bereich sichtbar (nur über Toggle "Alle")
- [x] Initial-Import: Jetzt starten

---

*Erstellt: 2026-07-10 08:45 UTC | Aktualisiert: 2026-07-10 09:00 UTC*
