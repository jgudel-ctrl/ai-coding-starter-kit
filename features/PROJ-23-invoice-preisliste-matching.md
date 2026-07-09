# PROJ-23: Invoice-Datenbank + Preislisten-Matching

> Status: 🟢 Approved
> Letzte Änderung: 2026-07-08
> Verantwortlich: Jan Bernd Gudel / Klausi

---

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Einen kompletten Invoice-Import aus Easybill (Rechnungsdaten ab 2023), dazu einen Preislisten-Upload für alle Hersteller/Lieferanten (inkl. Wolf). Beides wird in die Datenbank geladen und über Artikelnummern verknüpft — damit künftig jede Rechnungsposition einem konkreten Artikel zugeordnet werden kann. Fehlende Artikelnummern werden markiert, fehlende Preislisten können jederzeit nachgeladen werden.

**Was Jan Bernd dadurch erreicht:**
- **Controlling:** Klarer Überblick über alle Verkäufe und den zugrundeliegenden Artikeln
- **Bestellhistorie:** Kunden können genau sehen, welche Artikel sie wann gekauft haben (statt nur Beschreibungstext)
- **Preisvergleich:** Über die Artikel-Verlinkung können Preisentwicklungen verglichen werden

---

## Akzeptanzkriterien

### Invoice-Import (Easybill)
- [ ] Tabelle `invoices` neu aufsetzen mit allen relevanten Feldern
- [ ] Tabelle `invoice_items` neu aufsetzen mit Feldern für Artikelnummer, Beschreibung, Menge, Preise
- [ ] Import aus Easybill-Export (CSV/Excel) — einmalig manuell, später täglich per Cronjob
- [ ] Nur Daten ab 2023 importieren
- [ ] Import-Historie speichern (wann, wie viele Zeilen, Fehler)
- [ ] Duplikate erkennen (z.B. gleiche Rechnungsnummer) und überspringen
- [ ] Keine Preislisten nötig beim initialen Import — die kommen später
- [ ] Nach Preislisten-Upload: automatisches Matching der Artikelnummern

### Preislisten-Verwaltung
- [ ] Admin-Bereich `/verwaltung/preislisten`
- [ ] Upload-Formular mit Pflichtfeldern: Hersteller + Jahr der Preisliste
- [ ] Unterstützte Formate: CSV, XLS, XLSX
- [ ] Nach Upload: automatisches Matching der Artikelnummern mit bestehenden Invoice-Items
- [ ] Übersicht aller hochgeladenen Preislisten (Hersteller, Jahr, Datum, Artikelanzahl)
- [ ] Eigene "Schärfpreisliste" gruppiert nach Artikelgruppen (Sägeblätter HW, Sägeblätter HSS, Senker, etc.)
- [ ] Preislisten können gelöscht werden (mit Warnung)

### Artikel-Matching
- [ ] Invoice-Item-Artikelnummer → Preislisten-Artikelnummer (fuzzy wenn nötig)
- [ ] Bei Treffer: verknüpften Artikel in Invoice-Item speichern
- [ ] Kein Treffer: "unmatched" markieren (sichtbar im Admin)
- [ ] Nach neuem Preislisten-Upload: automatisches Re-Matching
- [ ] Übersicht über alle ungematchten Artikelnummern

### Admin-Features
- [ ] Preislisten-Upload nur für Admins
- [ ] Übersicht über alle Preislisten
- [ ] "Katalog-Verlinkung" — Link zum Hersteller-Katalog (optional)
- [ ] Unmatched-Artikel-Report (welche Artikelnummern fehlen wo)

---

## Datenmodell

### `invoices` (neu aufsetzen)
```
id               UUID PK
invoice_number   VARCHAR  -- Easybill Rechnungsnummer
document_date    DATE     -- Rechnungsdatum
partner_id       UUID FK  → tms.partners
partner_name     VARCHAR  -- Kunde (für den Fall dass partner_id nicht gematcht werden kann)
total_net        DECIMAL(12,2)  -- Nettosumme
total_gross      DECIMAL(12,2)  -- Bruttosumme
currency         VARCHAR  -- z.B. EUR
status           VARCHAR  -- z.B. paid, open, cancelled
source_file      VARCHAR  -- Welche Datei importiert wurde
imported_at      TIMESTAMP
```

### `invoice_items` (neu aufsetzen)
```
id               UUID PK
invoice_id       UUID FK  → invoices
line_number      INT      -- Zeilennummer in Rechnung
description      TEXT     -- Artikelbeschreibung aus Easybill
article_number   VARCHAR  -- Artikelnummer aus Easybill
quantity         DECIMAL(10,2)  -- Menge
unit_price_net   DECIMAL(12,2)  -- Einzelpreis netto
total_net        DECIMAL(12,2)  -- Zeilensumme netto
discount_percent DECIMAL(5,2)   -- Rabatt %
revenue_category VARCHAR   -- trade_goods, service, custom (wie bisher)
matched_article_id UUID FK  → price_list_items (nullable)
matched_at       TIMESTAMP
match_confidence DECIMAL(3,2) -- 0-1, für fuzzy matching
```

### `price_lists` (neu)
```
id               UUID PK
manufacturer     VARCHAR  -- Herstellername
year             INT      -- Jahr der Preisliste
file_name        VARCHAR  -- Original-Dateiname
uploaded_by      UUID     → auth.users
uploaded_at      TIMESTAMP
article_count    INT      -- Anzahl Artikel nach Import
status           VARCHAR  -- active, processing, error
```

### `price_list_items` (neu)
```
id               UUID PK
price_list_id    UUID FK  → price_lists
article_group    VARCHAR  -- z.B. "Sägeblätter HW", "Senker", etc.
article_number   VARCHAR  -- Artikelnummer (wie vom Hersteller)
description      TEXT     -- Beschreibung
unit_price_net   DECIMAL(12,2)  -- Nettopreis
currency         VARCHAR
unit             VARCHAR  -- z.B. Stück, Paar, etc.
matched_count    INT      -- Wie oft wurde dieser Artikel in Invoices gefunden
```

### `invoice_imports` (neu — Import-Historie)
```
id               UUID PK
file_name        VARCHAR
import_type      VARCHAR  -- invoices, price_list
records_total    INT
records_imported INT
records_failed   INT
started_at       TIMESTAMP
finished_at      TIMESTAMP
status           VARCHAR  -- running, completed, failed
error_log        TEXT
performed_by     UUID     → auth.users
```

---

## UI / Screens

### 1. Admin: Preislisten-Übersicht (`/verwaltung/preislisten`)
- Tabelle aller Preislisten (Hersteller, Jahr, Upload-Datum, Artikelanzahl)
- Upload-Button (öffnet Modal)
- Löschen-Button pro Preisliste
- Filter/Suche nach Hersteller

### 2. Admin: Preislisten-Upload (Modal)
- Datei-Upload (CSV/XLSX)
- Pflichtfeld: Hersteller (Dropdown/Text)
- Pflichtfeld: Jahr (Number)
- Optional: Katalog-Link
- Upload-Fortschrittsanzeige
- Ergebnis: X Artikel importiert, Y gematcht

### 3. Admin: Unmatched-Artikel (`/verwaltung/preislisten/unmatched`)
- Liste aller Invoice-Items ohne Matching
- Spalten: Artikelnummer, Beschreibung, Rechnung, Kunde
- Filter nach Zeitraum
- Hinweis: "Diese Artikel fehlen in den Preislisten"

### 4. Admin: Import-Status (`/verwaltung/importe`)
- Liste aller Import-Jobs
- Status (laufend/abgeschlossen/fehlgeschlagen)
- Anzahl Datensätze, Fehler-Log

---

## Technische Notizen

- **Schema:** Alles in `tms` Schema
- **Service-Role-Client:** Für Admin-Operationen (Upload, Import)
- **RLS:** Anon-User hat keinen Zugriff auf Preislisten → nur Admins
- **Cronjob:** Täglicher Import aus Easybill-Export (später)
- **Dateiformate:** CSV mit Encoding-Erkennung, XLSX via SheetJS
- **Matching:** Exact match auf `article_number`, dann Levenshtein-Distanz als Fallback
- **Performance:** Bei großen Imports Batch-Insert verwenden (500-1000 Zeilen pro Batch)
- **Easybill-Export:** CSV mit Header, Spalten: Rechnungsnr., Datum, Kunde, Artikelnr., Bezeichnung, Menge, Einzelpreis, Gesamtpreis, Rabatt

---

## Offene Fragen

1. Easybill-Export: Welche Spalten hat die CSV genau? (Beispieldatei nötig)
2. Preislisten-Excel: Wie sehen die Spalten aus? (Beispieldatei nötig)
3. Sollen alte Invoice-Daten migriert oder komplett neu aufgesetzt?
4. Wie viele Rechnungen/Positionen sind ab 2023 zu erwarten?
5. Sollen die Preislisten öffentlich (für alle Nutzer) oder nur Admin?

---

## Abhängigkeiten

- Keine direkten Abhängigkeiten zu bestehenden Features
- Nutzt bestehende `tms.partners` für Kunden-Mapping
- Erweitert `invoice_items` und `invoices` (neu aufsetzen)

---

## Milestones

1. **M1:** Datenbank-Tabellen neu aufsetzen (invoices, invoice_items)
2. **M2:** Einmaliger manueller Easybill-Import (CSV)
3. **M3:** Preislisten-Upload (Admin-Bereich)
4. **M4:** Artikel-Matching (automatisch + Re-Matching)
5. **M5:** Unmatched-Artikel-Übersicht
6. **M6:** Cronjob für täglichen Import (Easybill)
7. **M7:** Schärfpreisliste mit Gruppierung
