# PROJ-23 — Architektur: Invoice-Datenbank + Preislisten-Matching

**Status:** 🔵 In Review  
**Erstellt:** 2026-07-08  
**Scope:** Datenbank-Neuaufbau + Preislisten-Upload + Artikel-Matching

---

## Zusammenfassung

Kompletter Neuaufbau der Invoice-Daten (`invoices`, `invoice_items`) mit Import-Tracking. Neue Preislisten-Tabellen für Hersteller-Preislisten. Automatisches Matching von Invoice-Artikelnummern zu Preislisten-Artikeln. Admin-Bereich für Upload und Übersicht.

---

## 1. Datenbank-Schema

### 1.1 Custom Types

```sql
-- Invoice-Status
CREATE TYPE invoice_status AS ENUM ('paid', 'open', 'cancelled', 'overdue');

-- Revenue-Kategorie (wie bisher, erweitert)
CREATE TYPE revenue_category AS ENUM ('trade_goods', 'service', 'custom');

-- Import-Status
CREATE TYPE import_status AS ENUM ('running', 'completed', 'failed', 'partial');
```

### 1.2 Tabelle: `invoices` (neu aufsetzen)

```sql
DROP TABLE IF EXISTS tms.invoice_items CASCADE;
DROP TABLE IF EXISTS tms.invoices CASCADE;

CREATE TABLE tms.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL,              -- z.B. "RE-2024-00123"
    document_date DATE NOT NULL,               -- Rechnungsdatum
    partner_id UUID REFERENCES tms.partners(id) ON DELETE SET NULL,
    partner_name TEXT,                         -- Fallback wenn Partner nicht gematcht
    total_net DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_gross DECIMAL(12,2) NOT NULL DEFAULT 0,
    vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    status invoice_status NOT NULL DEFAULT 'paid',
    notes TEXT,                                -- Interne Notizen
    
    -- Import-Tracking
    source_file TEXT,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Constraints
    CONSTRAINT uk_invoices_number UNIQUE (invoice_number)
);

CREATE INDEX idx_invoices_partner_id ON tms.invoices(partner_id);
CREATE INDEX idx_invoices_document_date ON tms.invoices(document_date DESC);
CREATE INDEX idx_invoices_status ON tms.invoices(status);
CREATE INDEX idx_invoices_imported_at ON tms.invoices(imported_at DESC);
```

### 1.3 Tabelle: `invoice_items` (neu aufsetzen)

```sql
CREATE TABLE tms.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES tms.invoices(id) ON DELETE CASCADE,
    line_number INT NOT NULL DEFAULT 1,
    
    -- Aus Easybill
    description TEXT NOT NULL DEFAULT '',
    article_number TEXT,                       -- z.B. "HW-SB-120-30"
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit_price_net DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_net DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_percent DECIMAL(5,2),
    
    -- Revenue-Kategorie (wie bisher, aus Quelldaten)
    revenue_category revenue_category,
    
    -- Matching (Preisliste)
    matched_article_id UUID REFERENCES tms.price_list_items(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ,
    match_confidence DECIMAL(3,2) DEFAULT 1.00, -- 1.0 = exact, 0.8 = fuzzy, 0 = failed
    
    -- Constraints
    CONSTRAINT uk_invoice_items_line UNIQUE (invoice_id, line_number)
);

CREATE INDEX idx_invoice_items_invoice_id ON tms.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_article_number ON tms.invoice_items(article_number);
CREATE INDEX idx_invoice_items_matched ON tms.invoice_items(matched_article_id) 
    WHERE matched_article_id IS NOT NULL;
CREATE INDEX idx_invoice_items_unmatched ON tms.invoice_items(article_number) 
    WHERE matched_article_id IS NULL AND article_number IS NOT NULL;
```

### 1.4 Tabelle: `price_lists`

```sql
CREATE TABLE tms.price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer TEXT NOT NULL,                -- z.B. "Wolf", "Leitz", "Festool"
    year INT NOT NULL,                         -- z.B. 2024
    file_name TEXT NOT NULL,
    catalog_url TEXT,                          -- Optional: Link zum Katalog
    article_count INT NOT NULL DEFAULT 0,
    
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    status TEXT NOT NULL DEFAULT 'active',     -- active, processing, error, deleted
    
    -- Constraints
    CONSTRAINT uk_price_lists_manufacturer_year UNIQUE (manufacturer, year)
);

CREATE INDEX idx_price_lists_manufacturer ON tms.price_lists(manufacturer);
CREATE INDEX idx_price_lists_year ON tms.price_lists(year);
```

### 1.5 Tabelle: `price_list_items`

```sql
CREATE TABLE tms.price_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID NOT NULL REFERENCES tms.price_lists(id) ON DELETE CASCADE,
    
    -- Artikel-Informationen
    article_group TEXT NOT NULL,               -- z.B. "Sägeblätter HW", "Senker"
    article_number TEXT NOT NULL,              -- z.B. "HW-SB-120-30"
    description TEXT,
    unit_price_net DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    unit TEXT DEFAULT 'Stück',                 -- z.B. Stück, Paar, Set
    
    -- Matching-Statistik
    matched_count INT NOT NULL DEFAULT 0,      -- Wie oft in Invoices gefunden
    
    -- Constraints
    CONSTRAINT uk_price_list_items_article UNIQUE (price_list_id, article_number)
);

CREATE INDEX idx_price_list_items_price_list ON tms.price_list_items(price_list_id);
CREATE INDEX idx_price_list_items_article_group ON tms.price_list_items(article_group);
CREATE INDEX idx_price_list_items_article_number ON tms.price_list_items(article_number);
```

### 1.6 Tabelle: `invoice_imports` (Import-Historie)

```sql
CREATE TABLE tms.invoice_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name TEXT NOT NULL,
    import_type TEXT NOT NULL DEFAULT 'invoices', -- invoices, price_list
    records_total INT NOT NULL DEFAULT 0,
    records_imported INT NOT NULL DEFAULT 0,
    records_failed INT NOT NULL DEFAULT 0,
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    
    status import_status NOT NULL DEFAULT 'running',
    error_log TEXT,
    
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_invoice_imports_status ON tms.invoice_imports(status);
CREATE INDEX idx_invoice_imports_started_at ON tms.invoice_imports(started_at DESC);
```

---

## 2. RLS (Row Level Security)

```sql
-- ============================================
-- INVOICES
-- ============================================
ALTER TABLE tms.invoices ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten User können lesen
CREATE POLICY invoices_select_policy ON tms.invoices
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Nur Admins können schreiben
CREATE POLICY invoices_insert_admin_policy ON tms.invoices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoices_update_admin_policy ON tms.invoices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoices_delete_admin_policy ON tms.invoices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- INVOICE_ITEMS
-- ============================================
ALTER TABLE tms.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_select_policy ON tms.invoice_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoice_items_insert_admin_policy ON tms.invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_items_update_admin_policy ON tms.invoice_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_items_delete_admin_policy ON tms.invoice_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- PRICE_LISTS
-- ============================================
ALTER TABLE tms.price_lists ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten User können lesen (sichtbar in der App)
CREATE POLICY price_lists_select_policy ON tms.price_lists
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Nur Admins können schreiben
CREATE POLICY price_lists_insert_admin_policy ON tms.price_lists
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY price_lists_update_admin_policy ON tms.price_lists
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY price_lists_delete_admin_policy ON tms.price_lists
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- PRICE_LIST_ITEMS
-- ============================================
ALTER TABLE tms.price_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_list_items_select_policy ON tms.price_list_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY price_list_items_insert_admin_policy ON tms.price_list_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY price_list_items_update_admin_policy ON tms.price_list_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY price_list_items_delete_admin_policy ON tms.price_list_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- INVOICE_IMPORTS
-- ============================================
ALTER TABLE tms.invoice_imports ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten User können lesen
CREATE POLICY invoice_imports_select_policy ON tms.invoice_imports
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Nur Admins können schreiben
CREATE POLICY invoice_imports_insert_admin_policy ON tms.invoice_imports
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_imports_update_admin_policy ON tms.invoice_imports
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );
```

---

## 3. Server Actions (Admin-Only)

### 3.1 Import Actions

```typescript
// src/lib/actions/invoice-import.ts

// Einzelner Invoice-Import aus CSV/Excel
export async function importInvoicesFromFile(
  fileContent: string,  // CSV als String
  fileName: string,
  options?: { skipHeader?: boolean; delimiter?: string; }
): Promise<{
  ok: boolean;
  importId: string;
  imported: number;
  failed: number;
  errors?: string[];
}>;

// Preisliste importieren (nach Upload)
export async function importPriceList(
  fileContent: string,
  fileName: string,
  manufacturer: string,
  year: number,
  catalogUrl?: string
): Promise<{
  ok: boolean;
  priceListId: string;
  imported: number;
  matched: number;  // Wie viele Invoice-Items wurden verknüpft
}>;

// Re-Matching nach neuem Upload
export async function reMatchInvoiceItems(
  priceListId?: string  // optional: nur für eine Preisliste
): Promise<{
  ok: boolean;
  matched: number;
  unmatched: number;
}>;

// Import-Status abrufen
export async function getImportStatus(importId: string);

// Import-Historie
export async function getImportHistory(
  page: number,
  pageSize: number,
  type?: 'invoices' | 'price_list'
);
```

### 3.2 Preislisten Actions

```typescript
// src/lib/actions/price-lists.ts

export async function getPriceLists(
  search?: string,
  manufacturer?: string,
  year?: number
): Promise<{
  ok: boolean;
  lists: PriceList[];
}>;

export async function getPriceListDetail(
  id: string
): Promise<{
  ok: boolean;
  list: PriceList;
  items: PriceListItem[];
  groups: string[];  -- Eindeutige Artikelgruppen
}>;

export async function getPriceListItems(
  priceListId: string,
  group?: string,
  search?: string,
  page?: number,
  pageSize?: number
);

export async function deletePriceList(id: string): Promise<{ ok: boolean }>;

// Unmatched Items
export async function getUnmatchedInvoiceItems(
  page?: number,
  pageSize?: number,
  dateFrom?: Date,
  dateTo?: Date
): Promise<{
  ok: boolean;
  items: UnmatchedItem[];
  totalCount: number;
}>;
```

### 3.3 Invoice Actions (erweitert)

```typescript
// src/lib/actions/invoices.ts

export async function getInvoiceDetail(id: string): Promise<{
  ok: boolean;
  invoice: Invoice;
  items: InvoiceItem[];
}>;

export async function getInvoiceItemsWithArticles(
  invoiceId: string
): Promise<{
  ok: boolean;
  items: (InvoiceItem & { article: PriceListItem | null })[];
}>;
```

---

## 4. Matching-Logik

### 4.1 Algorithmus

```typescript
// src/lib/matching/article-matcher.ts

/**
 * Matching-Strategie:
 * 1. Exact match: article_number (uppercase, getrimmt) == article_number in price_list_items
 * 2. Normalized match: Leerzeichen, Bindestriche entfernt
 * 3. Fuzzy match: Levenshtein-Distanz <= 2 (nur bei Kurznummern < 20 Zeichen)
 * 
 * Confidence:
 * - 1.00 = Exact match
 * - 0.90 = Normalized match
 * - 0.80 = Fuzzy match (Levenshtein <= 2)
 * - 0.00 = No match
 */

export async function matchInvoiceItems(
  priceListId: string,
  batchSize: number = 1000
): Promise<{ matched: number; unmatched: number }> {
  // 1. Alle Items der Preisliste laden (in Memory, als Map)
  // 2. Alle ungematchten Invoice-Items laden (Batch)
  // 3. Für jedes Item: Suche in Map
  // 4. Update bei Treffer
  // 5. Statistik zurückgeben
}
```

### 4.2 Re-Matching

```typescript
export async function reMatchAllInvoiceItems(): Promise<void> {
  // 1. Alle Invoice-Items zurücksetzen: matched_article_id = NULL
  // 2. Für jede Preisliste (neueste zuerst):
  //    a. Alle Items der Preisliste als Map laden
  //    b. Alle ungematchten Invoice-Items durchgehen
  //    c. Matching durchführen
  //    d. matched_count in price_list_items aktualisieren
}
```

---

## 5. Komponenten-Struktur

### 5.1 Admin: Preislisten-Übersicht

```
src/app/(app)/verwaltung/preislisten/
├── page.tsx                          # Server-Komponente (Admin-Check)
├── components/
│   ├── price-list-table.tsx            # Tabelle aller Preislisten
│   ├── price-list-upload-modal.tsx     # Upload-Modal (CSV/XLSX)
│   ├── price-list-delete-dialog.tsx    # Löschen-Dialog
│   └── price-list-filter.tsx           # Filter (Hersteller, Jahr)
├── [id]/
│   ├── page.tsx                        # Detailseite: Artikel der Preisliste
│   └── components/
│       ├── price-list-detail.tsx
│       ├── article-group-tabs.tsx      # Tabs pro Artikelgruppe
│       └── article-table.tsx
```

### 5.2 Admin: Unmatched-Artikel

```
src/app/(app)/verwaltung/preislisten/unmatched/
├── page.tsx
└── components/
    ├── unmatched-table.tsx
    ├── unmatched-filter.tsx            # Filter nach Zeitraum, Hersteller
    └── unmatched-stats.tsx             # Statistik-Karten
```

### 5.3 Admin: Import-Historie

```
src/app/(app)/verwaltung/importe/
├── page.tsx
└── components/
    ├── import-history-table.tsx
    └── import-status-badge.tsx
```

### 5.4 CSV/Excel Parser

```
src/lib/parsers/
├── csv-parser.ts                       # CSV-Parser mit Encoding-Erkennung
├── excel-parser.ts                     # XLSX-Parser via SheetJS
└── types.ts                            # Gemeinsame Typen
```

---

## 6. Tech-Entscheidungen

| Entscheidung | Begründung |
|--------------|-----------|
| **SheetJS (xlsx)** für Excel | De-facto Standard, client- und server-seitig nutzbar |
| **CSV als String** an Server Action | Kein File-Upload nötig, Client liest File und sendet als Base64/Text |
| **In-Memory Matching** | Preislisten haben typisch < 10.000 Artikel, passt in Memory |
| **Batch-Update** (500-1000 Zeilen) | Supabase hat Limits bei Bulk-Updates |
| **Service-Role-Client** für Import | Admin-Operationen, RLS würde Anon-Client blockieren |
| **Keine Materialized View** (zunächst) | Matching ist dynamisch, könnte später als View |
| **Exact match zuerst, dann fuzzy** | Schnellste Strategie, 80%+ Treffer werden exakt sein |

---

## 7. Import-Workflow

### 7.1 Einmaliger Easybill-Import (manuell)

```
Admin öffnet /verwaltung/importe
  → Klickt "Easybill-Import"
  → Lädt CSV hoch
  → Client parsed CSV
  → Server Action: importInvoicesFromFile()
    → INSERT INTO invoice_imports (running)
    → Parse jede Zeile
    → INSERT INTO invoices (Batch)
    → INSERT INTO invoice_items (Batch)
    → UPDATE invoice_imports (completed)
    → Re-Matching automatisch starten
  → Ergebnis: X Rechnungen, Y Positionen, Z gematcht
```

### 7.2 Täglicher Import (später via Cronjob)

```
Cronjob (täglich, z.B. 02:00 Uhr):
  → Lädt Easybill-Export von API/Datei
  → Nur neue Rechnungen (invoice_number nicht vorhanden)
  → Import wie oben
  → Re-Matching
  → Ergebnis in Log/Notification
```

### 7.3 Preislisten-Upload

```
Admin öffnet /verwaltung/preislisten
  → Klickt "Neue Preisliste"
  → Formular: Hersteller, Jahr, Datei
  → Client parsed Datei (CSV/XLSX)
  → Zeigt Vorschau (erste 5 Zeilen)
  → Admin bestätigt
  → Server Action: importPriceList()
    → INSERT INTO price_lists
    → INSERT INTO price_list_items (Batch)
    → Auto-Re-Matching
    → Ergebnis: X Artikel importiert, Y Invoice-Items gematcht
```

---

## 8. Datei-Formate

### 8.1 Easybill-CSV (erwartet)

```csv
Rechnungsnr.,Datum,Kunde,Kundennummer,Artikelnr.,Bezeichnung,Menge,Einheit,Einzelpreis,Rabatt%,Gesamtpreis,Netto
RE-2024-001,2024-03-15,Muster GmbH,10001,HW-SB-120,Sägeblatt HW 120mm,2,Stk,45.50,0,91.00,91.00
```

**Wichtig:** Spalten-Mapping muss konfigurierbar sein (da Easybill-Export-Spalten variieren können).

### 8.2 Preislisten-Excel (erwartet)

```
Spalte A: Artikelnummer
Spalte B: Bezeichnung
Spalte C: Artikelgruppe (oder aus Dateiname/Sheet-Name)
Spalte D: Preis (netto)
Spalte E: Einheit
```

**Wichtig:** Mapping muss konfigurierbar sein (Spalten-Auswahl im Upload).

---

## 9. Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| Easybill-CSV-Spalten passen nicht | Hoch | Konfigurierbares Spalten-Mapping im Upload |
| Excel-Encoding falsch (Umlaute) | Mittel | Encoding-Erkennung (UTF-8 / ISO-8859-1 / Windows-1252) |
| Große Datei (> 50MB) | Niedrig | Chunked-Upload, Streaming-Parser |
| Fuzzy Matching zu langsam | Mittel | Exact match zuerst, nur Rest fuzzy |
| Doppelte Artikelnummern in Preisliste | Mittel | UNIQUE Constraint (price_list_id, article_number) |
| Import bricht ab | Niedrig | Batch-Insert, Fehler werden geloggt, Fortsetzung möglich |

---

## 10. Testing (nach Deploy)

```sql
-- Test 1: Tabellen existieren
SELECT COUNT(*) FROM tms.invoices;
SELECT COUNT(*) FROM tms.invoice_items;
SELECT COUNT(*) FROM tms.price_lists;
SELECT COUNT(*) FROM tms.price_list_items;

-- Test 2: Constraints funktionieren
-- Doppelte Rechnungsnummer sollte fehlschlagen:
INSERT INTO tms.invoices (invoice_number, document_date, total_net) 
VALUES ('DUPLICATE', '2024-01-01', 100);
INSERT INTO tms.invoices (invoice_number, document_date, total_net) 
VALUES ('DUPLICATE', '2024-01-01', 100); -- Sollte fehlschlagen

-- Test 3: Matching funktioniert
SELECT ii.article_number, ii.description, pli.article_number, pli.description
FROM tms.invoice_items ii
LEFT JOIN tms.price_list_items pli ON ii.matched_article_id = pli.id
WHERE ii.matched_article_id IS NOT NULL
LIMIT 10;

-- Test 4: Unmatched Items
SELECT COUNT(*) FROM tms.invoice_items 
WHERE matched_article_id IS NULL AND article_number IS NOT NULL;
```

---

## 11. Nächste Schritte (nach diesem PR)

1. **Frontend:** Preislisten-Upload UI
2. **Frontend:** Preislisten-Übersicht + Detail
3. **Frontend:** Unmatched-Artikel-Report
4. **Backend:** CSV/Excel Parser implementieren
5. **Backend:** Import-Actions implementieren
6. **Backend:** Matching-Algorithmus
7. **Cronjob:** Täglicher Easybill-Import (später)

---

**Warte auf Approval von Jan Bernd bevor ich mit Frontend/Backend beginne.**