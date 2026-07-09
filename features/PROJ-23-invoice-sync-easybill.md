# PROJ-23: Invoice-Sync via Easybill API (REVISED)

> Status: 🟠 In Review
> Letzte Änderung: 2026-07-09
> Verantwortlich: Jan Bernd Gudel / Klausi

---

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Ein kompletter Neuaufbau der Invoice-Datenbank (invoices + invoice_items) mit täglicher automatischer Synchronisation aus Easybill. Alle Rechnungen und Positionen ab 01.01.2023 werden aus der Easybill-API geholt und in unserer Datenbank gespeichert — inklusive Bezahlstatus, Kundenverknüpfung und vollständigem Artikel-Detail.

**Was Jan Bernd dadurch erreicht:**
- **Vollständige Übersicht:** Jede Rechnung jederzeit im TMS sichtbar — ohne in Easybill suchen zu müssen
- **Bezahlstatus auf einen Blick:** Grün = bezahlt, Rot = offen, Gelb = teilweise bezahlt
- **Kunden-Detail:** Beim Kunden direkt alle seine Rechnungen sehen (inkl. Positionen und Artikel)
- **Automatisch aktuell:** Jeden Morgen frische Daten — kein manuelles Importieren mehr

---

## Akzeptanzkriterien

### Datenbank-Neuaufbau
- [ ] Tabellen `invoices` und `invoice_items` komplett leeren und neu aufsetzen
- [ ] Alle verfügbaren Felder aus der Easybill API speichern (siehe "Easybill API Felder" unten)
- [ ] Verknüpfung: `invoice_items.invoice_id` → `invoices.id`
- [ ] Verknüpfung: `invoices.partner_id` → `tms.partners` (via `easybill_customer_number`)

### API-Sync (Easybill)
- [ ] Täglicher Cronjob (z.B. 02:00 Uhr) ruft alle Dokumente ab 01.01.2023
- [ ] Dokument-Typen: `INVOICE`, `CREDIT` (Gutschrift), `STORNO`, `STORNO_CREDIT`
- [ ] Nur Dokumente mit `is_draft = false` und `type IN ('INVOICE', 'CREDIT', 'STORNO', 'STORNO_CREDIT')`
- [ ] Für jedes Dokument: alle Positionen (`items`) importieren
- [ ] Für jedes Dokument: alle Zahlungen (`payments`) importieren
- [ ] Bezahlstatus berechnen: `paid_amount >= total_amount` → "bezahlt", `paid_amount > 0` → "teilweise", sonst "offen"
- [ ] Delta-Sync: Nur neue/geänderte Dokumente seit letztem Lauf

### Bezahlstatus & Übersicht
- [ ] Spalte `payment_status` in invoices: `paid`, `partial`, `open`, `overdue`
- [ ] Spalte `paid_amount` (in Cent, wie Easybill)
- [ ] Spalte `paid_at` (letztes Zahlungsdatum)
- [ ] Spalte `due_date` (Fälligkeitsdatum) für Überfälligkeit
- [ ] Admin-Übersicht: Alle Rechnungen mit Filter (bezahlt/offen/überfällig)

### Kunden-Verknüpfung
- [ ] Bei Sync: `customer_id` aus Easybill → `easybill_customer_number` in `tms.partners` suchen
- [ ] Bei Treffer: `partner_id` in `invoices` setzen
- [ ] Kein Treffer: `partner_id = NULL`, aber `partner_name` und `customer_id` speichern für manuelles Matching

### Performance
- [ ] Batch-Verarbeitung (max. 1000 Dokumente pro Request, Easybill-Limit)
- [ ] Seitenweise Pagination durch API
- [ ] Inkrementeller Sync (nur geänderte/neue seit letztem Lauf)

---

## Easybill API — Alle verfügbaren Felder

> Quelle: https://api.easybill.de/rest/v1/swagger.json (Version 1.98.2)

### Document (Rechnung / Dokument)

| Feld | Typ | Beschreibung | Speichern? |
|------|-----|-------------|------------|
| `id` | integer (int64) | Easybill Dokument-ID | ✅ PK |
| `number` | string | Rechnungsnummer (z.B. "RE-2024-00123") | ✅ |
| `type` | enum | `INVOICE`, `CREDIT`, `STORNO`, `STORNO_CREDIT`, ... | ✅ |
| `document_date` | date (string) | Rechnungsdatum | ✅ |
| `due_date` | date (string) | Fälligkeitsdatum | ✅ |
| `due_in_days` | integer | Zahlungsziel in Tagen | ✅ |
| `customer_id` | integer (int64) | Easybill Kunden-ID | ✅ |
| `contact_id` | integer (int64) | Kontakt-ID | ✅ |
| `amount` | integer (Cent) | Brutto-Gesamtbetrag | ✅ |
| `amount_net` | integer (Cent) | Netto-Gesamtbetrag | ✅ |
| `paid_amount` | integer (Cent) | Bereits bezahlt | ✅ |
| `paid_at` | date (string) | Letztes Zahlungsdatum | ✅ |
| `currency` | string | Währung (z.B. EUR) | ✅ |
| `status` | enum | `ACCEPT`, `DONE`, `DROPSHIPPING`, `CANCEL` | ✅ |
| `is_draft` | boolean | Ist Entwurf? (nur false = importieren) | ✅ |
| `is_archive` | boolean | Archiviert? | ✅ |
| `cancel_id` | integer (int64) | ID der stornierten Rechnung | ✅ |
| `ref_id` | integer (int64) | Referenz-Dokument-ID | ✅ |
| `root_id` | integer (int64) | Stammdokument-ID | ✅ |
| `order_number` | string | Bestellnummer | ✅ |
| `buyer_reference` | string | Leitweg-ID / Buyer Reference | ✅ |
| `project_id` | integer | Projekt-ID | ✅ |
| `text` | string | Freitext auf Rechnung | ✅ |
| `text_prefix` | string | Text-Präfix | ✅ |
| `text_tax` | string | MwSt.-Text | ✅ |
| `title` | string | Titel | ✅ |
| `discount` | string | Rabatt | ✅ |
| `discount_type` | enum | `PERCENT`, `AMOUNT` | ✅ |
| `cash_allowance` | float | Skonto-Prozentsatz | ✅ |
| `cash_allowance_days` | integer | Skonto-Tage | ✅ |
| `cash_allowance_text` | string | Skonto-Text | ✅ |
| `calc_vat_from` | integer | 0=Netto, 1=Brutto | ✅ |
| `vat_option` | enum | MwSt.-Option (NULL, nStb, nStbUstID, ...) | ✅ |
| `vat_country` | string | MwSt.-Land | ✅ |
| `vat_id` | string | USt-IdNr. | ✅ |
| `billing_country` | string | Rechnungsland | ✅ |
| `shipping_country` | string | Lieferland | ✅ |
| `fulfillment_country` | string | Erfüllungsland | ✅ |
| `payment_link_enabled` | boolean | Zahlungslink aktiviert? | ✅ |
| `payment_link_locale` | enum | `de` oder `en` | ✅ |
| `use_shipping_address` | boolean | Lieferadresse verwenden? | ✅ |
| `is_oss` | boolean | One-Stop-Shop? | ✅ |
| `is_replica` | boolean | Replikat? | ✅ |
| `replica_url` | string | Replikat-URL | ✅ |
| `external_id` | string | Externe ID | ✅ |
| `pdf_template` | string | PDF-Vorlage | ✅ |
| `pdf_pages` | integer | Anzahl PDF-Seiten | ✅ |
| `bank_debit_form` | string | Lastschriftformular | ✅ |
| `service_date` | object | Leistungsdatum (type, date, date_from, date_to, text) | ✅ |
| `recurring_options` | object | Wiederkehrende Optionen | ✅ |
| `address` | object | Dokument-Adresse (Firma, Name, Straße, PLZ, Ort, Land) | ✅ |
| `label_address` | object | Label-Adresse | ✅ |
| `customer_snapshot` | object | Kunden-Snapshot | ✅ |
| `contact_label` | string | Kontakt-Label | ✅ |
| `contact_text` | string | Kontakt-Text | ✅ |
| `login_id` | integer (int64) | Login-ID (Mitarbeiter) | ✅ |
| `last_postbox_id` | integer (int64) | Postbox-ID | ✅ |
| `item_notes` | array | Eindeutige Notizen pro Position | ✅ |
| `attachment_ids` | array | Anhang-IDs | ✅ |
| `advanced_data_fields` | array | EN16931 Business Terms | ✅ |
| `file_format_config` | array | Dateiformat-Konfiguration | ✅ |
| `created_at` | datetime | Erstellt am | ✅ |
| `edited_at` | datetime | Bearbeitet am | ✅ |
| `anonymize_status` | enum | `NOT_ANONYMIZED`, `ANONYMIZED` | ✅ |
| `anonymize_due_date` | date | Anonymisierungsdatum | ✅ |
| `anonymized_at` | datetime | Anonymisiert am | ✅ |
| `is_acceptable_on_public_domain` | boolean | Öffentlich akzeptierbar? | ✅ |

### DocumentPosition (Rechnungsposition)

| Feld | Typ | Beschreibung | Speichern? |
|------|-----|-------------|------------|
| `id` | integer (int64) | Easybill Position-ID | ✅ PK |
| `document_id` | integer (int64) | Dokument-ID | ✅ FK |
| `position` | integer | Zeilennummer (1, 2, 3...) | ✅ |
| `type` | enum | `POSITION`, `POSITION_NOCALC`, `TEXT` | ✅ |
| `itemType` | enum | `PRODUCT`, `SERVICE`, `UNDEFINED` | ✅ |
| `number` | string | Artikelnummer | ✅ |
| `description` | string | Artikelbeschreibung | ✅ |
| `document_note` | string | Dokument-Notiz | ✅ |
| `note` | string | Interne Notiz | ✅ |
| `quantity` | float | Menge | ✅ |
| `quantity_str` | string | Menge als Text (z.B. "1:30 h") | ✅ |
| `unit` | string | Einheit | ✅ |
| `single_price_net` | float (Cent) | Einzelpreis netto | ✅ |
| `single_price_gross` | float (Cent) | Einzelpreis brutto | ✅ |
| `total_price_net` | float (Cent) | Zeilensumme netto | ✅ |
| `total_price_gross` | float (Cent) | Zeilensumme brutto | ✅ |
| `total_vat` | float (Cent) | MwSt. für Zeile | ✅ |
| `vat_percent` | float | MwSt.-Satz (z.B. 19.0) | ✅ |
| `discount` | float | Rabatt | ✅ |
| `discount_type` | enum | `PERCENT`, `AMOUNT`, `QUANTITY`, `FIX` | ✅ |
| `cost_price_net` | float (Cent) | Einkaufspreis netto | ✅ |
| `cost_price_total` | float (Cent) | Einkaufspreis gesamt | ✅ |
| `cost_price_charge` | float | Kostenaufschlag | ✅ |
| `cost_price_charge_type` | enum | `PERCENT`, `AMOUNT` | ✅ |
| `position_id` | integer (int64) | Referenz auf Stammdaten-Position | ✅ |
| `booking_account` | string | Buchungskonto | ✅ |
| `export_cost_1` | string | Export-Kosten 1 | ✅ |
| `export_cost_2` | string | Export-Kosten 2 | ✅ |
| `serial_number` | string | Seriennummer | ✅ |
| `serial_number_id` | string | Seriennummer-ID | ✅ |

### DocumentPayment (Zahlung)

| Feld | Typ | Beschreibung | Speichern? |
|------|-----|-------------|------------|
| `id` | integer (int64) | Zahlungs-ID | ✅ PK |
| `document_id` | integer (int64) | Dokument-ID | ✅ FK |
| `amount` | integer (Cent) | Betrag | ✅ |
| `payment_at` | date | Zahlungsdatum | ✅ |
| `type` | string | Zahlungsart | ✅ |
| `provider` | string | Zahlungsanbieter | ✅ |
| `reference` | string | Zahlungsreferenz | ✅ |
| `notice` | string | Notiz | ✅ |
| `is_overdue_fee` | boolean | Mahngebühr? | ✅ |
| `login_id` | integer (int64) | Login-ID | ✅ |

---

## Datenmodell (aktualisiert)

### `invoices` (NEU aufsetzen)

```sql
CREATE TABLE tms.invoices (
    -- Primärschlüssel (Easybill ID)
    id BIGINT PRIMARY KEY,                    -- Easybill document.id

    -- Dokument-Identifikation
    invoice_number TEXT NOT NULL,            -- document.number
    type TEXT NOT NULL,                      -- document.type (INVOICE, CREDIT, STORNO, etc.)
    document_date DATE NOT NULL,             -- document.document_date
    due_date DATE,                           -- document.due_date
    due_in_days INTEGER,                     -- document.due_in_days
    status TEXT,                             -- document.status
    is_draft BOOLEAN NOT NULL DEFAULT false, -- document.is_draft
    is_archive BOOLEAN NOT NULL DEFAULT false, -- document.is_archive

    -- Kunde
    customer_id BIGINT,                      -- document.customer_id (Easybill Kundennummer)
    partner_id UUID REFERENCES tms.partners(id) ON DELETE SET NULL, -- Verknüpfung zu TMS
    partner_name TEXT,                       -- Kundenname (Fallback)
    contact_id BIGINT,                       -- document.contact_id

    -- Beträge (alle in Cent, wie Easybill)
    amount INTEGER NOT NULL DEFAULT 0,        -- document.amount (Brutto)
    amount_net INTEGER NOT NULL DEFAULT 0,   -- document.amount_net (Netto)
    paid_amount INTEGER NOT NULL DEFAULT 0,  -- document.paid_amount
    currency TEXT NOT NULL DEFAULT 'EUR',    -- document.currency

    -- Bezahlstatus (berechnet)
    payment_status TEXT NOT NULL DEFAULT 'open', -- paid, partial, open, overdue
    paid_at DATE,                            -- document.paid_at

    -- Rabatt / Skonto
    discount TEXT,                           -- document.discount
    discount_type TEXT,                      -- PERCENT, AMOUNT
    cash_allowance NUMERIC(5,2),             -- document.cash_allowance
    cash_allowance_days INTEGER,             -- document.cash_allowance_days
    cash_allowance_text TEXT,                -- document.cash_allowance_text

    -- MwSt.
    calc_vat_from INTEGER,                   -- 0=Netto, 1=Brutto
    vat_option TEXT,                         -- NULL, nStb, nStbUstID, etc.
    vat_country TEXT,                        -- document.vat_country
    vat_id TEXT,                             -- document.vat_id

    -- Referenzen
    cancel_id BIGINT,                        -- document.cancel_id
    ref_id BIGINT,                           -- document.ref_id
    root_id BIGINT,                          -- document.root_id
    order_number TEXT,                       -- document.order_number
    buyer_reference TEXT,                    -- document.buyer_reference
    project_id BIGINT,                       -- document.project_id
    external_id TEXT,                        -- document.external_id

    -- Texte
    title TEXT,                              -- document.title
    text TEXT,                               -- document.text
    text_prefix TEXT,                        -- document.text_prefix
    text_tax TEXT,                           -- document.text_tax

    -- Länder
    billing_country TEXT,                    -- document.billing_country
    shipping_country TEXT,                   -- document.shipping_country
    fulfillment_country TEXT,                -- document.fulfillment_country

    -- Adressen (als JSONB gespeichert)
    address JSONB,                           -- document.address (Firma, Name, Straße, PLZ, Ort, Land)
    label_address JSONB,                     -- document.label_address
    customer_snapshot JSONB,                 -- document.customer_snapshot

    -- Zahlung / Verarbeitung
    payment_link_enabled BOOLEAN,            -- document.payment_link_enabled
    payment_link_locale TEXT,                -- document.payment_link_locale
    use_shipping_address BOOLEAN,            -- document.use_shipping_address
    bank_debit_form TEXT,                    -- document.bank_debit_form

    -- Sonstiges
    is_oss BOOLEAN DEFAULT false,            -- document.is_oss
    is_replica BOOLEAN DEFAULT false,        -- document.is_replica
    replica_url TEXT,                        -- document.replica_url
    pdf_template TEXT,                       -- document.pdf_template
    pdf_pages INTEGER,                       -- document.pdf_pages
    login_id BIGINT,                         -- document.login_id
    last_postbox_id BIGINT,                  -- document.last_postbox_id
    contact_label TEXT,                      -- document.contact_label
    contact_text TEXT,                       -- document.contact_text

    -- Anonymisierung
    anonymize_status TEXT,                   -- NOT_ANONYMIZED, ANONYMIZED
    anonymize_due_date DATE,                 -- document.anonymize_due_date
    anonymized_at TIMESTAMPTZ,               -- document.anonymized_at
    is_acceptable_on_public_domain BOOLEAN,  -- document.is_acceptable_on_public_domain

    -- Arrays (als JSONB)
    item_notes JSONB,                        -- document.item_notes
    attachment_ids JSONB,                    -- document.attachment_ids
    advanced_data_fields JSONB,              -- document.advanced_data_fields
    file_format_config JSONB,                -- document.file_format_config

    -- Leistungsdatum
    service_date JSONB,                      -- document.service_date
    recurring_options JSONB,                 -- document.recurring_options

    -- Sync-Tracking
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL,         -- document.created_at
    edited_at TIMESTAMPTZ,                   -- document.edited_at

    -- Constraints
    CONSTRAINT uk_invoices_number UNIQUE (invoice_number)
);

-- Indizes
CREATE INDEX idx_invoices_partner_id ON tms.invoices(partner_id);
CREATE INDEX idx_invoices_document_date ON tms.invoices(document_date DESC);
CREATE INDEX idx_invoices_type ON tms.invoices(type);
CREATE INDEX idx_invoices_payment_status ON tms.invoices(payment_status);
CREATE INDEX idx_invoices_customer_id ON tms.invoices(customer_id);
CREATE INDEX idx_invoices_last_synced ON tms.invoices(last_synced_at DESC);
```

### `invoice_items` (NEU aufsetzen)

```sql
CREATE TABLE tms.invoice_items (
    -- Primärschlüssel (Easybill Position-ID)
    id BIGINT PRIMARY KEY,                    -- Easybill document_position.id
    invoice_id BIGINT NOT NULL REFERENCES tms.invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 1,      -- document_position.position (Zeilennummer)

    -- Positionstyp
    type TEXT,                               -- POSITION, POSITION_NOCALC, TEXT
    item_type TEXT,                          -- PRODUCT, SERVICE, UNDEFINED

    -- Artikel
    article_number TEXT,                     -- document_position.number
    description TEXT NOT NULL DEFAULT '',    -- document_position.description
    document_note TEXT,                      -- document_position.document_note
    internal_note TEXT,                      -- document_position.note
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0, -- document_position.quantity
    quantity_str TEXT,                       -- document_position.quantity_str
    unit TEXT,                               -- document_position.unit

    -- Preise (alle in Cent)
    single_price_net INTEGER NOT NULL DEFAULT 0,  -- document_position.single_price_net
    single_price_gross INTEGER NOT NULL DEFAULT 0, -- document_position.single_price_gross
    total_price_net INTEGER NOT NULL DEFAULT 0,   -- document_position.total_price_net
    total_price_gross INTEGER NOT NULL DEFAULT 0, -- document_position.total_price_gross
    total_vat INTEGER NOT NULL DEFAULT 0,          -- document_position.total_vat
    vat_percent NUMERIC(5,2),                    -- document_position.vat_percent

    -- Rabatt
    discount NUMERIC(10,2),                  -- document_position.discount
    discount_type TEXT,                      -- PERCENT, AMOUNT, QUANTITY, FIX

    -- Kosten
    cost_price_net INTEGER,                  -- document_position.cost_price_net
    cost_price_total INTEGER,                -- document_position.cost_price_total
    cost_price_charge NUMERIC(10,2),         -- document_position.cost_price_charge
    cost_price_charge_type TEXT,             -- PERCENT, AMOUNT

    -- Referenzen
    position_id BIGINT,                    -- document_position.position_id
    booking_account TEXT,                    -- document_position.booking_account
    export_cost_1 TEXT,                      -- document_position.export_cost_1
    export_cost_2 TEXT,                      -- document_position.export_cost_2
    serial_number TEXT,                      -- document_position.serial_number
    serial_number_id TEXT,                   -- document_position.serial_number_id

    -- Sync-Tracking
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uk_invoice_items_position UNIQUE (invoice_id, position)
);

-- Indizes
CREATE INDEX idx_invoice_items_invoice_id ON tms.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_article_number ON tms.invoice_items(article_number);
CREATE INDEX idx_invoice_items_item_type ON tms.invoice_items(item_type);
```

### `invoice_payments` (NEU)

```sql
CREATE TABLE tms.invoice_payments (
    id BIGINT PRIMARY KEY,                    -- Easybill document_payment.id
    invoice_id BIGINT NOT NULL REFERENCES tms.invoices(id) ON DELETE CASCADE,

    amount INTEGER NOT NULL DEFAULT 0,       -- document_payment.amount (Cent)
    payment_at DATE,                         -- document_payment.payment_at
    payment_type TEXT,                        -- document_payment.type
    provider TEXT,                          -- document_payment.provider
    reference TEXT,                         -- document_payment.reference
    notice TEXT,                            -- document_payment.notice
    is_overdue_fee BOOLEAN DEFAULT false,   -- document_payment.is_overdue_fee
    login_id BIGINT,                        -- document_payment.login_id

    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_payments_invoice_id ON tms.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_at ON tms.invoice_payments(payment_at DESC);
```

### `invoice_sync_log` (NEU — für Cronjob-Tracking)

```sql
CREATE TABLE tms.invoice_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',    -- running, completed, failed, partial
    documents_fetched INTEGER NOT NULL DEFAULT 0,
    documents_inserted INTEGER NOT NULL DEFAULT 0,
    documents_updated INTEGER NOT NULL DEFAULT 0,
    items_inserted INTEGER NOT NULL DEFAULT 0,
    payments_inserted INTEGER NOT NULL DEFAULT 0,
    errors TEXT,                               -- JSON-Array mit Fehlern
    error_message TEXT,                        -- Letzter Fehler
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_sync_log_started_at ON tms.invoice_sync_log(started_at DESC);
CREATE INDEX idx_sync_log_status ON tms.invoice_sync_log(status);
```

---

## API-Endpunkte (Easybill)

### Basis-URL
```
https://api.easybill.de/rest/v1
```

### Authentication
```
Authorization: Bearer <API_KEY>
```

### Endpunkte

| Aktion | Methode | URL | Beschreibung |
|--------|---------|-----|--------------|
| Liste Dokumente | GET | `/documents?type=INVOICE,CREDIT,STORNO,STORNO_CREDIT&is_draft=false&limit=1000&page={n}` | Alle Rechnungen |
| Einzelnes Dokument | GET | `/documents/{id}` | Details + items |
| Positionen | GET | `/documents/{id}/items` | Positionen der Rechnung |
| Zahlungen | GET | `/documents/{id}/payments` | Zahlungen der Rechnung |
| Pagination | GET | `/documents?limit=1000&page={n}` | Seitenweise (max 1000/Seite) |

### Request-Limit
- **PLUS:** 10 Requests/Minute
- **BUSINESS:** 60 Requests/Minute

---

## Sync-Strategie

### Initial-Sync (einmalig)
1. **Alle Dokumente ab 01.01.2023** abrufen
2. Für jedes Dokument:
   - Basisdaten in `invoices` INSERT (oder UPDATE bei vorhanden)
   - Alle Positionen in `invoice_items` INSERT/UPDATE
   - Alle Zahlungen in `invoice_payments` INSERT/UPDATE
3. **Bezahlstatus berechnen:**
   - `paid_amount >= amount` → `payment_status = 'paid'`
   - `paid_amount > 0` → `payment_status = 'partial'`
   - `due_date < heute()` → `payment_status = 'overdue'`
   - Sonst → `payment_status = 'open'`

### Delta-Sync (täglich via Cronjob)
1. `edited_at > letzter_sync` filtern
2. Nur geänderte Dokumente abrufen
3. Gleiche INSERT/UPDATE Logik wie Initial-Sync
4. Gelöschte Dokumente erkennen (werden in Easybill "archiviert")

---

## Bezahlstatus-Logik

```typescript
function calculatePaymentStatus(invoice: Invoice): PaymentStatus {
    if (invoice.paid_amount >= invoice.amount) {
        return 'paid';
    }
    if (invoice.paid_amount > 0) {
        return 'partial';
    }
    if (invoice.due_date && new Date(invoice.due_date) < new Date()) {
        return 'overdue';
    }
    return 'open';
}
```

---

## UI / Screens

### 1. Admin: Invoice-Übersicht (`/verwaltung/invoices`)
- Tabelle aller Rechnungen mit Spalten:
  - Rechnungsnummer | Kunde | Datum | Netto | Bezahlstatus | Fälligkeitsdatum
- Filter: Typ (Rechnung/Gutschrift), Bezahlstatus (alle/offen/teilweise/bezahlt/überfällig), Zeitraum
- Sortierung: Nach Datum, Betrag, Kunde
- Pagination

### 2. Admin: Invoice-Detail (`/verwaltung/invoices/{id}`)
- Kopfdaten: Kunde, Adresse, Datum, Fälligkeit, Bezahlstatus
- Tabelle aller Positionen (Artikelnr., Beschreibung, Menge, Preis, Rabatt, Summe)
- Zahlungen: Liste aller Zahlungen mit Datum, Betrag, Zahlungsart
- Gesamt: Brutto, Netto, MwSt., Bezahlt, Offen

### 3. Kunden-Detail: Rechnungen (neuer Tab oder erweitert)
- Liste aller Rechnungen des Kunden (letzte 12 Monate)
- Farbcodiert: Grün = bezahlt, Rot = überfällig, Orange = offen, Blau = teilweise
- Link zur Invoice-Detail

### 4. Admin: Sync-Status (`/verwaltung/invoices/sync`)
- Letzter Sync: Wann, wie viele Dokumente, Status
- Manueller Sync-Start (Button "Jetzt synchronisieren")
- Fehler-Log der letzten Syncs
- Cronjob-Status

---

## Cronjob

```json
{
  "name": "Easybill Invoice Sync",
  "schedule": { "kind": "cron", "expr": "0 2 * * *", "tz": "Europe/Berlin" },
  "payload": {
    "kind": "agentTurn",
    "message": "Führe den täglichen Easybill Invoice-Sync durch. Lade alle Dokumente vom Typ INVOICE, CREDIT, STORNO, STORNO_CREDIT ab 01.01.2023. Hole alle Positionen und Zahlungen. Berechne Bezahlstatus. Speichere in tms.invoices, tms.invoice_items, tms.invoice_payments. Logge Ergebnisse in tms.invoice_sync_log.",
    "model": "ollama-cloud/kimi-k2.6"
  },
  "sessionTarget": "isolated",
  "delivery": { "mode": "announce" }
}
```

**Zeit:** Täglich um 02:00 Uhr (Europe/Berlin)
**Funktion:** Delta-Sync — nur geänderte/neue Dokumente seit letztem Lauf

---

## Technische Notizen

- **API-Key:** Muss in `.env` als `EASYBILL_API_KEY` hinterlegt werden
- **Request-Limit:** BUSINESS-Plan = 60 req/min → bei großen Datenmengen Pausen einbauen
- **Preise:** Easybill gibt alles in Cent → in DB als INTEGER (Cent) speichern, bei Anzeige /100
- **Datum:** Easybill liefert `Europe/Berlin` → in DB als DATE/TIMESTAMPTZ
- **JSONB-Felder:** `address`, `label_address`, `customer_snapshot`, `service_date`, `recurring_options` als JSONB
- **Partner-Matching:** `customer_id` (Easybill) → `easybill_customer_number` in `tms.partners`
- **RLS:** Admin-Only für Schreiben, alle eingeloggten User für Lesen

---

## Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| API-Rate-Limit überschritten | Mittel | Pausen zwischen Requests (1 Sekunde), Retry-Logik |
| API-Key fehlt/ungültig | Niedrig | Prüfung vor Sync, Fehler-Log |
| Große Datenmenge (>10.000 Rechnungen) | Mittel | Batch-Verarbeitung, Pagination |
| Easybill-Downtime | Niedrig | Fehler-Log, nächster Tag erneut versuchen |
| Kunde nicht in TMS gefunden | Mittel | `partner_id = NULL`, Liste für manuelles Matching |
| Datum-Konvertierung fehlerhaft | Niedrig | Parse-Validierung, ISO-Format |

---

## Abhängigkeiten

- `EASYBILL_API_KEY` muss in der `.env` hinterlegt sein
- `tms.partners` muss `easybill_customer_number` enthalten
- Supabase-Service-Role-Client für Admin-Insert

---

## Offene Fragen

1. **Easybill API-Key:** Wo ist der aktuelle API-Key hinterlegt?
2. **Plan:** Welchen Easybill-Tarif habt ihr? (PLUS = 10 req/min, BUSINESS = 60 req/min)
3. **Anzahl Rechnungen:** Wie viele Rechnungen gibt es ca. ab 2023?
4. **Gutschriften:** Sollen Gutschriften (CREDIT) als negative Beträge behandelt werden?

---

## Milestones

1. **M1:** Datenbank-Tabellen neu aufsetzen (invoices, invoice_items, invoice_payments, invoice_sync_log)
2. **M2:** Easybill API-Client + Initial-Sync (alle Rechnungen ab 2023)
3. **M3:** Bezahlstatus-Berechnung + UI (Invoice-Übersicht, Detail)
4. **M4:** Delta-Sync + Cronjob (täglich)
5. **M5:** Kunden-Detail: Rechnungen-Tab erweitern
6. **M6:** Sync-Status-Seite + Fehler-Handling
