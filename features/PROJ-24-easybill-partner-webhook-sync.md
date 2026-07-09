# PROJ-24: Easybill Partner-Sync via Webhook

> Status: ✅ Deployed | 2026-07-09 19:04 UTC  
> Letzte Änderung: 2026-07-09  
> Verantwortlich: Jan Bernd Gudel / Klausi  
> Priorität: Hoch (67 fehlende Kunden, keine Neuanlage seit ~4 Wochen)

---

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Einen automatischen Sync, der neue Kunden aus Easybill in unsere Superbays-Datenbank überträgt — sobald sie in Easybill angelegt oder geändert werden. Das passiert über einen Webhook (wie ein Postbote, der direkt an unsere Tür klopft, statt dass wir stündlich beim Briefkasten nachschauen).

**Was Jan Bernd dadurch erreicht:**
- **Keine verlorenen Kunden mehr:** Wer in Easybill angelegt wird, ist sofort auch im TMS
- **Keine "Wer ist das?"-Rechnungen mehr:** Rechnungen kommen automatisch mit korrektem Kunden-Link an
- **Aktuelle Adressdaten:** Adressänderungen in Easybill landen automatisch bei uns
- **Kein manuelles Nachtragen:** Spart Zeit, vermeidet Fehler
- **Rabatte sichtbar:** Jeder Kunde zeigt seine spezifischen Rabatte pro Produktgruppe

---

## IST-Analyse: Datenbank-Struktur

### Kern-Tabelle: `tms.partners`

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `id` | UUID | ✅ | Unsere interne Partner-ID |
| `partner_number` | TEXT | — | Interne Kundennummer (optional) |
| `easybill_id` | BIGINT | — | Easybill-Kunden-ID |
| `easybill_customer_number` | TEXT | — | Kundennummer bei Easybill (UNIQUE) |
| `partner_type` | TEXT | ✅ | 'customer' oder 'supplier' |
| `entity_type` | TEXT | — | z.B. 'company', 'person' |
| `company_name` | TEXT | — | Firmenname |
| `first_name` | TEXT | — | Vorname |
| `last_name` | TEXT | — | Nachname |
| `display_name` | TEXT | ✅ | Anzeigename (generiert) |
| `email` | TEXT | — | Haupt-E-Mail |
| `phone` | TEXT | — | Telefon |
| `mobile` | TEXT | — | Mobil |
| `website` | TEXT | — | Webseite |
| `vat_identifier` | TEXT | — | USt-IdNr. |
| `tax_number` | TEXT | — | Steuernummer |
| `easybill_group_id` | BIGINT | — | Easybill Kundengruppen-ID |
| `is_active` | BOOLEAN | ✅ | Aktiv? (default: true) |
| `is_archived` | BOOLEAN | ✅ | Archiviert? (default: false) |
| `duplicate_of` | UUID | — | Verweis auf Haupt-Dublette (**Regel Ü3**) |
| `duplicate_reason` | TEXT | — | Grund der Dublette-Markierung |
| `source_system` | TEXT | ✅ | 'easybill' (default) |
| `raw_easybill_payload` | JSONB | — | Komplettes Easybill-JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert bei uns |
| `easybill_created_at` | TIMESTAMPTZ | — | Erstellt in Easybill |
| `easybill_updated_at` | TIMESTAMPTZ | — | Zuletzt geändert in Easybill |

**Wichtige Constraints:**
- `easybill_customer_number` ist UNIQUE → Keine Duplikate
- `easybill_id` ist UNIQUE → Jeder Easybill-Kunde = ein Partner

### Verknüpfte Tabellen (was beim Import alles angelegt werden muss)

#### 1. `partner_addresses` — Adressen

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `partner_id` | UUID | ✅ | Verknüpfung zu partners.id |
| `address_type` | TEXT | ✅ | 'billing' (Rechnung) oder 'shipping' (Lieferung) |
| `company_name` | TEXT | — | Aus Easybill-Adresse |
| `first_name` | TEXT | — | Aus Easybill-Adresse |
| `last_name` | TEXT | — | Aus Easybill-Adresse |
| `street` | TEXT | — | Straße + Hausnummer |
| `postal_code` | TEXT | — | PLZ |
| `city` | TEXT | — | Ort |
| `country` | TEXT | — | Land (z.B. 'DE') |
| `raw_easybill_payload` | JSONB | — | Komplette Easybill-Adresse als JSON |

**Regel:** Jeder neue Partner bekommt mindestens eine Rechnungsadresse. Wenn in Easybill eine separate Lieferadresse existiert, zusätzlich eine Lieferadresse anlegen.

#### 2. `partner_contacts` — Kontaktpersonen

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `partner_id` | UUID | ✅ | Verknüpfung zu partners.id |
| `easybill_contact_id` | BIGINT | — | Easybill-Kontakt-ID |
| `first_name` | TEXT | — | Vorname |
| `last_name` | TEXT | — | Nachname |
| `display_name` | TEXT | — | Generierter Name |
| `email` | TEXT | — | E-Mail |
| `phone` | TEXT | — | Telefon |
| `mobile` | TEXT | — | Mobil |
| `role` | TEXT | — | z.B. 'Ansprechpartner' |
| `is_primary` | BOOLEAN | — | Hauptkontakt? (default: true für ersten) |
| `is_invoice_recipient` | BOOLEAN | — | Rechnungsempfänger? |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-Kontakt als JSON |

**Regel:** Jeder neue Partner bekommt mindestens einen Kontakt (Hauptansprechpartner). Wenn in Easybill mehrere Kontakte hinterlegt sind, alle importieren.

#### 3. `partner_billing_settings` — Zahlungseinstellungen

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `partner_id` | UUID | ✅ | Verknüpfung zu partners.id |
| `payment_terms_days` | INTEGER | — | Zahlungsziel in Tagen |
| `cash_discount_percent` | NUMERIC | — | Skonto-Prozentsatz |
| `cash_discount_days` | INTEGER | — | Skonto-Tage |
| `sepa_mandate_reference` | TEXT | — | Mandatsreferenz |
| `sepa_mandate_date` | DATE | — | Mandatsdatum |
| `iban_last4` | TEXT | — | Letzte 4 Stellen IBAN |
| `bic` | TEXT | — | BIC |
| `default_invoice_email` | TEXT | — | E-Mail für Rechnungen |
| `buyer_reference` | TEXT | — | Leitweg-ID |
| `vat_identifier` | TEXT | — | USt-IdNr. |
| `tax_number` | TEXT | — | Steuernummer |
| `raw_easybill_payload` | JSONB | — | Komplette Easybill-Zahlungsdaten |

**Regel:** Wenn in Easybill Zahlungs-/Rechnungseinstellungen vorhanden sind, importieren.

#### 4. `partner_order_defaults` — Auftrags-Defaults (PROJ-17)

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `partner_id` | UUID | ✅ | Verknüpfung zu partners.id |
| `inbound_type` | TEXT | — | 'bring' oder 'pickup' |
| `outbound_type` | TEXT | — | 'return' oder 'keep' |
| `pickup_delivery_status` | TEXT | — | Status |
| `source` | TEXT | — | Quelle |
| `driver_id` | UUID | — | Zugewiesener Fahrer |
| `pickup_cycle_count` | INTEGER | — | Abholzyklus (Wochen) |
| `pickup_day` | INTEGER | — | Abholtag |

**Regel:** Beim ersten Import leer lassen (keine Defaults). Der Admin/AV setzt diese später manuell.

#### 5. `partner_discounts` — Kunden-Rabatte (pro Produktgruppe)

> **Werkstatt-Vergleich:** Jeder Kunde hat einen eigenen "Preislisten-Zettel" — auf manche Werkzeuggruppen gibt es 25%, auf andere 40% Rabatt. Das hängt an der Produktgruppe (z.B. "Kreissägeblätter").

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `id` | UUID | ✅ | PK, auto |
| `partner_id` | UUID | ✅ | Verknüpfung zu partners.id |
| `easybill_discount_id` | BIGINT | — | Easybill Rabatt-ID |
| `position_group_id` | BIGINT | — | Easybill Produktgruppen-ID |
| `position_group_name` | TEXT | — | Name der Produktgruppe |
| `position_group_number` | TEXT | — | Nummer der Produktgruppe (z.B. "W10") |
| `discount_percent` | NUMERIC | — | Rabatt-Prozentsatz |
| `discount_type` | TEXT | — | 'PERCENT' oder 'AMOUNT' |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-Rabatt als JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert |

**Regel:**
- Rabatte werden aus Easybill `/discounts/position-group` geholt
- Verknüpfung: `customer_id` (Easybill) → `partners.easybill_id`
- Jeder Rabatt gehört zu einer Produktgruppe (z.B. "W10 - Kreissägeblätter")
- Beim UPDATE: Alte Rabatte löschen, neue importieren (Voll-Replace)
- **Wichtig:** Rabatte ändern sich oft — daher bei jedem Sync komplett neu aufbauen

#### 6. `position_groups` — Produktgruppen (Referenz)

> **Werkstatt-Vergleich:** Das sind die "Regale" im Lager — jede Produktgruppe hat einen Namen und eine Nummer. Werkzeuge sind einem Regal zugeordnet.

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `id` | BIGINT | ✅ | Easybill Produktgruppen-ID (als PK) |
| `name` | TEXT | — | Name (z.B. "Kreissägeblätter") |
| `display_name` | TEXT | — | Anzeigename (z.B. "W10 - Kreissägeblätter") |
| `number` | TEXT | — | Nummer (z.B. "W10") |
| `description` | TEXT | — | Beschreibung (z.B. "HW-Sägeblätter, HSS-Sägeblätter...") |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert |

**Regel:**
- Produktgruppen werden einmalig aus Easybill `/position-groups` importiert
- Bei jedem Partner-Sync: Prüfen ob neue Produktgruppen dazugekommen sind
- Keine Duplikate — `id` ist PK

#### 7. `customer_groups` — Kundengruppen (Referenz)

> **Werkstatt-Vergleich:** Das sind die "Kundenkategorien" — z.B. "Stammkunde", "Neukunde", "Großkunde". Jeder Kunde ist in einer Gruppe.

| Feld | Typ | Pflicht | Regel beim Import |
|------|-----|---------|-------------------|
| `id` | BIGINT | ✅ | Easybill Kundengruppen-ID (als PK) |
| `name` | TEXT | — | Name (z.B. "Kunden ohne Zuordnung") |
| `display_name` | TEXT | — | Anzeigename (z.B. "KD0 - Kunden ohne Zuordnung") |
| `number` | TEXT | — | Nummer (z.B. "KD0") |
| `description` | TEXT | — | Beschreibung |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert |

**Regel:**
- Kundengruppen werden aus Easybill `/customer-groups` importiert
- Verknüpfung: `partners.easybill_group_id` → `customer_groups.id`
- Bei jedem Partner-Sync: Gruppen aktualisieren

### Weitere verknüpfte Tabellen (nur Lesen, nicht Schreiben)

| Tabelle | Verknüpfung | Regel beim Import |
|---------|-------------|-------------------|
| `invoices` | `partner_id` | **Nur nach-sync:** Nach dem Partner-Import müssen offene Rechnungen (mit `customer_id` aber ohne `partner_id`) nachträglich verknüpft werden |
| `tours` | `partner_id` | Keine Aktion — bestehende Touren bleiben wie sie sind |
| `orders` | `partner_id` | Keine Aktion — historische Daten |
| `easybill_sync_logs` | `partner_id` | Wird gefüllt für Audit-Trail |

---

## Webhook-Architektur (Option A)

### Wie es funktioniert (Werkstatt-Vergleich)

> **Easybill Webhook** = Ein Lieferant ruft an: "Hallo, ich habe einen neuen Kunden für euch. Hier sind die Daten."
> **Unser Endpoint** = Ein Empfangstresen, der das Gespräch annimmt und die Daten in unser System einträgt.

### Ablauf

```
1. Easybill: Neuer Kunde angelegt
           ↓
2. Easybill sendet HTTP POST an unsere URL
   z.B. https://tms.gudel-werkzeuge.de/api/webhooks/easybill/customer
           ↓
3. Unser Server empfängt den Webhook
   - Prüft Authentizität (API-Key/Signatur)
   - Liest Kundendaten aus dem JSON-Body
           ↓
4. Sync-Logik:
   a) Prüfen: Gibt es diesen Kunden schon? (easybill_customer_number)
   b) NEU → Partner + Adressen + Kontakte + Billing + Rabatte anlegen
   c) UPDATE → Bestehende Daten aktualisieren
   d) Adressvalidierung (Geoapify) für Lieferadressen
           ↓
5. Ergebnis loggen in easybill_sync_logs
```

### Technische Details

**Easybill Webhook-Setup:**
- URL: `https://tms.gudel-werkzeuge.de/api/webhooks/easybill/customer`
- Event: `customer.created` und `customer.updated`
- Authentifizierung: API-Key im Header

**Unser Endpoint:**
- Route: `/api/webhooks/easybill/customer`
- Method: POST
- Body: JSON mit Kundendaten

**Sicherheit:**
- Webhook-Secret/Token prüfen (Easybill sendet API-Key im Header)
- IP-Whitelist (Easybill hat feste IP-Bereiche)
- HTTPS erzwungen
- Request-Body signieren und prüfen

### Fallback: Stündlicher Cronjob

Wenn der Webhook mal nicht funktioniert (z.B. Server offline), läuft zusätzlich ein **stündlicher Cronjob**, der:
- Alle Kunden abruft, die seit letztem Lauf geändert/erstellt wurden
- Dieselbe Sync-Logik ausführt
- Sicherstellt, dass nichts durchs Raster fällt

---

## Benutzer-definierte Regeln (von Jan Bernd)

### Regel Ü1: Anzeigename (display_name)

> **Vergleich:** Der Anzeigename ist wie der große Aufkleber auf der Akte — danach suche ich im Frontend.

- **Priorität 1:** Firmenname (`company_name`) — wenn vorhanden, IMMER verwenden
- **Priorität 2:** Vorname + Nachname (`first_name + " " + last_name`) — wenn keine Firma
- **Priorität 3:** "Unbekannt" — Fallback
- **Wichtig:** Dieser Name ist der Suchbegriff im Frontend. Er muss eindeutig und wiedererkennbar sein.

### Regel Ü2: Archivierte Easybill-Kunden

- Archivierte Kunden in Easybill **werden trotzdem importiert**
- Aber bei uns: `is_active = false` (inaktiv gesetzt)
- **Nie** physisch löschen — nur deaktivieren
- Grund: Historische Daten/Rechnungen bleiben erhalten

### Regel Ü3: Dubletten-Validierung (wichtig!)

> **Vergleich:** Zwei Akten mit gleichem Namen und gleicher Adresse → Die mit weniger Umsatz wird als Dublette markiert.

**Wann ist eine Dublette erkannt?**
Wenn **Firmenname UND/ODER Vorname+Nachname** übereinstimmen **UND** Rechnungsadresse übereinstimmt **ODER** Lieferadresse übereinstimmt.

**Ablauf bei Dublette:**
1. Beide Partner vergleichen
2. Umsatz prüfen (Summe aus `invoices.total_net`)
3. Der Partner mit **weniger oder keinem Umsatz** wird als Dublette markiert:
   - `is_active = false`
   - `duplicate_of = {id des Hauptpartners}` (neues Feld)
   - `duplicate_reason = 'Auto-detected: Same name/address'`
4. Der Partner mit **mehr Umsatz** bleibt aktiv
5. **Manuelle Prüfung empfohlen** — nicht automatisch mergen

### Regel Ü4: Pflicht-Adressen und Kontakte

| Was | Pflicht? | Fallback wenn Easybill nichts liefert |
|-----|----------|--------------------------------------|
| **Rechnungsadresse** | ✅ Ja | Fehler — Kunde kann nicht importiert werden |
| **Lieferadresse** | ✅ Ja | Rechnungsadresse als Lieferadresse kopieren |
| **Kontakt mit E-Mail** | ✅ Ja | Erster Kontakt aus Adresse übernehmen, E-Mail aus `email` Feld |

> **Wichtig:** Ein Partner ohne Rechnungsadresse oder ohne Kontakt mit E-Mail wird **abgelehnt** und in `easybill_sync_logs` mit Fehler geloggt.

### Regel Ü5: Gelöschte Adressen

- Adressen werden **nie physisch gelöscht**
- Stattdessen: `is_active = false` oder `deleted_at = TIMESTAMP`
- Grund: Historische Rechnungen/Touren verweisen noch auf alte Adressen

---

## Import-Regeln pro Tabelle

### Regel-Set A: `tms.partners` (Haupttabelle)

**Bei NEUEM Kunden (customer.created):**
1. **Prüfung:** Existiert bereits ein Partner mit dieser `easybill_customer_number`?
   - JA → Nicht neu anlegen, sondern als UPDATE behandeln
   - NEIN → Weiter mit Anlage
2. **display_name** generieren (**Regel Ü1**):
   - Wenn `company_name` vorhanden: `company_name` (immer bevorzugt!)
   - Sonst: `first_name + " " + last_name`
   - Fallback: "Unbekannt"
3. **Pflichtfelder** setzen:
   - `partner_type = 'customer'`
   - `source_system = 'easybill'`
   - `is_active = true` (bei archiviertem Easybill-Kunde: `false`, siehe **Regel Ü2**)
   - `is_archived = false`
4. **Kundengruppe:**
   - `easybill_group_id` aus Easybill übernehmen
   - Verknüpfung zu `customer_groups` herstellen
5. **Dubletten-Prüfung** (**Regel Ü3**):
   - Nach Anlage: Prüfen ob Dublette existiert (Name + Adresse)
   - Falls ja: Weniger umsatzstarken Partner deaktivieren
6. **Timestamps**:
   - `easybill_created_at` = Erstellungsdatum aus Easybill
   - `easybill_updated_at` = Änderungsdatum aus Easybill
7. **raw_easybill_payload** = Kompletter Easybill-Kunden-JSON speichern

**Bei UPDATE (customer.updated):**
1. Partner anhand `easybill_customer_number` finden
2. Nur Felder aktualisieren, die sich geändert haben
3. `display_name` aktualisieren falls Firmenname/Name geändert (**Regel Ü1**)
4. `updated_at` auf jetzt setzen
5. `easybill_updated_at` aktualisieren
6. `easybill_group_id` aktualisieren falls geändert
7. `is_active` aktualisieren falls Archiv-Status in Easybill geändert (**Regel Ü2**)

### Regel-Set B: `partner_addresses`

**Bei NEUEM Kunden:**
1. **Rechnungsadresse** anlegen (aus Easybill `address`):
   - `address_type = 'billing'`
   - `is_primary = true` (die eine aktive Rechnungsadresse)
   - Alle Felder aus Easybill-Adresse übernehmen
   - `raw_easybill_payload` = JSON der Adresse
2. **Lieferadresse** anlegen:
   - Falls in Easybill separate Lieferadresse existiert: Diese verwenden
   - Falls keine Lieferadresse: **Rechnungsadresse kopieren** (**Regel Ü4**)
   - `address_type = 'shipping'`
   - `is_primary = false`
3. **Adressvalidierung** (Geoapify):
   - Beide Adressen durch Geoapify-API schicken
   - Ergebnis in `geoapify_*` Feldern speichern
   - Falls ungültig: `geoapify_validation_status = 'invalid'` + `revalidate_address = true`

**Bei UPDATE:**
1. Bestehende Adressen des Partners finden
2. Prüfen: Hat sich die Adresse geändert?
   - JA → Adresse aktualisieren + Neu validieren
   - NEIN → Nichts tun
3. **Nur eine aktive Rechnungsadresse** erlaubt:
   - Wenn neue Rechnungsadresse angelegt wird: Alte Rechnungsadresse auf `is_primary = false`
   - Oder alte als `is_active = false` markieren (**Regel Ü5**)
4. **Gelöschte Adressen** (**Regel Ü5**):
   - Nie physisch löschen
   - `is_active = false` oder `deleted_at = TIMESTAMP`

**Wichtige Constraints:**
- Maximal **EINE** aktive (`is_primary = true`) Rechnungsadresse pro Partner
- Lieferadressen: beliebig viele erlaubt (aber mindestens eine)
- Gelöschte Adressen bleiben in DB für historische Verknüpfungen

### Regel-Set C: `partner_contacts`

**Bei NEUEM Kunden:**
1. Kontakt aus Easybill `contacts` übernehmen (oder Hauptkontakt aus Adresse)
   - **Pflicht:** E-Mail-Adresse muss vorhanden sein (**Regel Ü4**)
   - Falls keine E-Mail in Kontakten: E-Mail aus `partners.email` übernehmen
   - Falls auch dort keine: Kunde wird **abgelehnt** und mit Fehler geloggt
2. `is_primary = true` (erster Kontakt = Hauptkontakt)
3. `display_name` generieren: `first_name + " " + last_name`
4. Falls E-Mail aus Adresse vorhanden: `is_invoice_recipient = true`
5. **Mindestens ein Kontakt mit E-Mail** muss existieren (**Regel Ü4**)

**Bei UPDATE:**
1. Bestehende Kontakte abgleichen (anhand `easybill_contact_id`)
2. Neue Kontakte hinzufügen
3. Geänderte Kontakte aktualisieren
4. Gelöschte Kontakte als `is_active = false` markieren (nicht physisch löschen)
5. **Prüfen:** Gibt es noch mindestens einen Kontakt mit E-Mail?
   - NEIN → Fehler loggen, Admin benachrichtigen

**Wichtige Constraints:**
- Jeder Partner braucht mindestens **EINEN** Kontakt mit **E-Mail**
- Mehrere Kontakte erlaubt (Hauptkontakt + weitere Ansprechpartner)
- Gelöschte Kontakte bleiben in DB für historische Verknüpfungen

### Regel-Set D: `partner_billing_settings`

**Bei NEUEM Kunden:**
1. Falls Zahlungsdaten in Easybill vorhanden:
   - `payment_terms_days` = Zahlungsziel
   - `cash_discount_percent` / `cash_discount_days` = Skonto
   - `sepa_mandate_reference` = Mandatsreferenz
   - `default_invoice_email` = Rechnungs-E-Mail
   - `vat_identifier` = USt-IdNr.
   - `tax_number` = Steuernummer
2. `raw_easybill_payload` = JSON der Zahlungsdaten

**Bei UPDATE:**
1. Bestehende Billing-Einstellungen aktualisieren
2. Nur geänderte Felder überschreiben

### Regel-Set E: `partner_discounts` + `position_groups` + `customer_groups`

**Bei NEUEM Kunden:**
1. **Produktgruppen aktualisieren** (falls neue dazugekommen):
   - Alle Position-Groups von Easybill `/position-groups` laden
   - Neue Gruppen in `position_groups` INSERT (ON CONFLICT UPDATE)
2. **Kundengruppen aktualisieren**:
   - Alle Customer-Groups von Easybill `/customer-groups` laden
   - Neue Gruppen in `customer_groups` INSERT (ON CONFLICT UPDATE)
3. **Kunden-Rabatte importieren**:
   - Easybill: `GET /discounts/position-group?customer_id={easybill_id}`
   - Für jeden Rabatt: `partner_discounts` INSERT
   - Alte Rabatte des Partners vorher löschen (Voll-Replace)

**Bei UPDATE:**
1. Gleiche Logik wie bei NEU — Rabatte komplett neu aufbauen
2. Produktgruppen und Kundengruppen aktualisieren

> **Warum komplett neu aufbauen?** Rabatte können gelöscht, geändert oder neu hinzugefügt werden. Ein Delta-Sync wäre komplexer und fehleranfälliger.

### Regel-Set F: Nach-Sync Rechnungs-Verknüpfung

**Wichtig:** Nach jedem Partner-Import (neu oder update):
1. Suche alle `tms.invoices` mit `customer_id = easybill_customer_number` ABER `partner_id IS NULL`
2. Setze `partner_id = partners.id` (die gerade importierte/aktualisierte)
3. Zähle wie viele Rechnungen nachträglich verknüpft wurden

---

## Geoapify-Adressvalidierung

### Was ist das?

> **Vergleich:** Wie ein Adressprüfer bei DHL — er schaut, ob die Adresse wirklich existiert, korrigiert Schreibfehler, und gibt GPS-Koordinaten zurück.

### Ablauf

```
1. Neue Lieferadresse importiert
           ↓
2. Adresse an Geoapify API schicken:
   "Musterstraße 12, 12345 Berlin"
           ↓
3. Geoapify antwortet:
   - Status: 'valid' oder 'invalid'
   - Korrigierte Adresse: "Musterstraße 12, 12345 Berlin, Deutschland"
   - GPS-Koordinaten: lat=52.5200, lon=13.4050
   - Vertrauens-Score: 0.95
           ↓
4. Ergebnis in partner_addresses speichern:
   - geoapify_validation_status = 'valid'
   - geoapify_street = "Musterstraße"
   - geoapify_house_number = "12"
   - geoapify_postal_code = "12345"
   - geoapify_city = "Berlin"
   - geoapify_lat = 52.5200
   - geoapify_lon = 13.4050
   - geoapify_is_valid = true
```

### Konfiguration

**API-Key:** `GEOAPIFY_API_KEY=4c93f5bd7d8548f6a3d003c5af8a2848` (in `.env.production` hinterlegt)

**Geoapify Free-Tier Limits:**
- **3.000 Credits/Tag** → Bei uns: max. ~200 Requests/Tag (100 Partner × 2 Adressen)
- **Max. 5 Requests/Sekunde** → Wir machen max. 2 parallel, kein Problem
- **Ischrone/Isodistanz:** Bis 15 Min. / 10 km (für uns nicht relevant)
- **Kommerzielle Nutzung:** Erlaubt (Limitiert)
- **Support:** Best effort

**Kosten-Nutzen:**
- 67 fehlende Kunden = ~134 Adress-Validierungen = **~134 Credits**
- Täglich neue Kunden (geschätzt 1-3) = **~2-6 Credits/Tag**
- **Free-Tier reicht locker** für unsere Mengen

---

## Rabatt-Beispiel aus Easybill (Realdaten)

**Kunde:** Raiffeisen Hohe Mark Hamaland eG  
**Kundengruppe:** KD0 - Kunden ohne Zuordnung  
**Easybill ID:** 687795862

### Produktgruppen (Position Groups)

| ID | Nummer | Name | Beschreibung |
|----|--------|------|-------------|
| 92477 | W10 | Kreissägeblätter | HW-Sägeblätter, HSS-Sägeblätter, CV-Sägeblätter, HW-Nutsägeblätter |
| 92482 | W11 | Schaftfräser | HW-Schaftfräser, VHW-Schaftfräser, DP-Schaftfräser, HSS-Schaftfräser |
| 92487 | W12 | Bohrungsfräser | HW-Bohrungsfräser, WP-Bohrungsfräser, DP-Bohrungsfräser |
| 92492 | W13 | Bohrwerkzeuge | HW-Bohrer, VHW-Bohrer, HSS-Bohrer |
| 92497 | W14 | Wechselschneiden | Wendeschneidplatten, Hobelmesser |

*(... 40 Produktgruppen insgesamt)*

### Kunden-Rabatte (Position-Group Discounts)

| Kunde | Produktgruppe | Rabatt | Typ |
|-------|---------------|--------|-----|
| Kunde A | W10 (Kreissägeblätter) | 40% | PERCENT |
| Kunde A | W11 (Schaftfräser) | 25% | PERCENT |
| Kunde B | W10 (Kreissägeblätter) | 35% | PERCENT |
| Kunde C | W10 (Kreissägeblätter) | 40% | PERCENT |

*(... 880 Rabatte insgesamt)*

**Wichtig:** Jeder Kunde kann auf verschiedene Produktgruppen unterschiedliche Rabatte haben.

---

## Akzeptanzkriterien

### Webhook
- [ ] Endpoint `/api/webhooks/easybill/customer` erreichbar und sicher
- [ ] Easybill Webhook für `customer.created` und `customer.updated` konfiguriert
- [ ] Authentifizierung prüft API-Key/Signatur
- [ ] Neuer Kunde → Partner + Adressen + Kontakte + Billing + Rabatte werden angelegt
- [ ] Geänderter Kunde → Bestehende Daten werden aktualisiert
- [ ] Adressvalidierung via Geoapify für Lieferadressen
- [ ] Nach-Sync: Offene Rechnungen werden mit neuem Partner verknüpft
- [ ] Fehler werden in `easybill_sync_logs` protokolliert
- [ ] **Regel Ü1:** `display_name` verwendet immer Firmenname wenn vorhanden
- [ ] **Regel Ü2:** Archivierte Easybill-Kunden werden als `is_active=false` importiert
- [ ] **Regel Ü3:** Dubletten werden erkannt und der umsatzschwächere Partner deaktiviert
- [ ] **Regel Ü4:** Immer Lieferadresse + Kontakt mit E-Mail vorhanden
- [ ] **Regel Ü5:** Gelöschte Adressen/Kontakte nur deaktiviert, nie gelöscht

### Fallback-Cronjob
- [ ] Stündlicher Cronjob läuft zuverlässig
- [ ] Holt nur geänderte/neue Kunden seit letztem Lauf
- [ ] Identische Sync-Logik wie Webhook
- [ ] Ergebnis wird geloggt

### Datenqualität
- [ ] Alle 67 fehlenden Kunden sind importiert
- [ ] Keine Duplikate (easybill_customer_number ist UNIQUE)
- [ ] Adressen sind validiert (wo möglich)
- [ ] Kontakte sind vollständig übernommen
- [ ] Rabatte sind importiert (pro Produktgruppe)
- [ ] Produktgruppen sind aktuell
- [ ] Kundengruppen sind aktuell

---

## Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| Easybill Webhook kommt nicht an | Mittel | Fallback-Cronjob stündlich |
| Geoapify API-Limit erreicht | Niedrig | Requests zählen, bei Limit überspringen |
| Adresse ungültig/unklar | Mittel | Als 'invalid' markieren, manuell prüfen |
| Kunde in Easybill gelöscht | Niedrig | Als `is_archived = true` markieren, nicht löschen |
| Doppelte Kundennummer | Niedrig | UNIQUE constraint verhindert Duplikate |
| Webhook-Secret kompromittiert | Niedrig | IP-Whitelist + HTTPS + Token-Rotation |
| Rabatte ändern sich ständig | Mittel | Voll-Replace bei jedem Sync |
| Dublette erkannt, aber falsch | Niedrig | Nur deaktivieren (nicht mergen), Admin prüft |
| Keine E-Mail bei Easybill-Kontakt | Mittel | Kunde wird abgelehnt + geloggt, manuelle Nacharbeit |

---

## Offene Entscheidungen (für Jan Bernd)

1. **Soll ich den Webhook bauen?** → ✅ Ja (entschieden)
2. **Soll der stündliche Fallback-Cronjob auch laufen?** → ✅ Ja (entschieden)
3. **Sollen gelöschte Easybill-Kunden bei uns auch gelöscht werden?** → ❌ Nein, nur archivieren (entschieden)
4. **Geoapify API-Key:** → Ja (entschieden) — besorge ich
5. **Sollen Kunden-Rabatte auch in die Rechnungserstellung übernommen werden?** → Relevant für spätere Features

---

## Nächste Schritte

1. **Jan Bernd:** Spec review (inkl. Rabatte) + "approved"
2. **Klausi:** Webhook-Endpoint bauen + Geoapify-Integration
3. **Klausi:** Neue Tabellen anlegen (`partner_discounts`, `position_groups`, `customer_groups`)
4. **Klausi:** Fallback-Cronjob einrichten
5. **Gemeinsam:** Easybill Webhook in Easybill-UI konfigurieren
6. **Test:** Einen neuen Kunden in Easybill anlegen → Prüfen, ob er im TMS landet + Rabatte korrekt sind
