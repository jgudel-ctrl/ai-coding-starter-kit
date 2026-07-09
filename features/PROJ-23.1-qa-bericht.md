# PROJ-23.1 — QA-Checkliste: Invoice-Sync via Easybill API

**Erstellt:** 2026-07-09

---

## Akzeptanzkriterien

### ✅ Datenbank-Neuaufbau
- [x] Tabellen `invoices`, `invoice_items`, `invoice_payments`, `invoice_sync_log` gelöscht und neu erstellt
- [x] Alle Easybill-Felder vorhanden (50+ in invoices, 30+ in invoice_items, 10 in invoice_payments)
- [x] Verknüpfung: `invoice_items.invoice_id` → `invoices.id`
- [x] Verknüpfung: `invoices.partner_id` → `tms.partners` (via `easybill_customer_number`)
- [x] Indizes für schnelle Abfragen
- [x] RLS Policies: SELECT für alle, INSERT/UPDATE/DELETE nur für Admin

### ✅ Easybill API-Client
- [x] Basis-Client mit TypeScript-Typen
- [x] Auth: Bearer Token
- [x] Rate-Limit-Handling (429 Retry)
- [x] Pagination für große Datenmengen
- [x] Endpunkte: Documents, Document Items, Document Payments

### ✅ Sync-Logik
- [x] Bezahlstatus berechnen: paid / partial / open / overdue
- [x] Partner-Matching via `easybill_customer_number`
- [x] Delta-Sync (nur geänderte/neue seit letztem Lauf)
- [x] Nur Dokumente ab 01.01.2023
- [x] Nur `is_draft = false`
- [x] Nur Typen: INVOICE, CREDIT, STORNO, STORNO_CREDIT
- [x] Batch-Verarbeitung mit Pause zwischen Requests

### ✅ Server Actions
- [x] `getInvoices` — Liste mit Filter/Paginierung
- [x] `getInvoiceById` — Detail mit Positionen + Zahlungen
- [x] `syncInvoicesNow` — Manueller Sync
- [x] `getSyncLog` — Sync-History
- [x] `getInvoiceSummary` — Dashboard-Zusammenfassung

### ✅ Admin-UI
- [x] Invoice-Übersicht (`/verwaltung/invoices`)
  - [x] Tabelle mit Rechnungsnr., Kunde, Datum, Fällig, Netto, Bezahlt, Status
  - [x] Filter: Bezahlstatus, Dokumenttyp, Suche
  - [x] Pagination
  - [x] Farbige Status-Badges
- [x] Invoice-Detail (`/verwaltung/invoices/[id]`)
  - [x] Kopfdaten: Kunde, Adresse, Datum, Fälligkeit
  - [x] Beträge: Brutto, Netto, Bezahlt, Offen
  - [x] Positionen-Tabelle
  - [x] Zahlungen-Tabelle
  - [x] Rechnungstext
- [x] Sync-Status (`/verwaltung/invoices/sync`)
  - [x] Manueller Sync-Button
  - [x] Ergebnis-Anzeige
  - [x] Fehler-Log
  - [x] Info über automatischen Cronjob

### ✅ Navigation
- [x] "Rechnungen" im Admin-Menü (Burger + Dropdown)
- [x] Icon: Receipt (Lucide)

### ✅ Cronjob
- [x] Täglich um 02:00 Uhr (Europe/Berlin)
- [x] Isolated Session
- [x] Announce Delivery

### ✅ TypeScript / Build
- [x] `npx tsc --noEmit` erfolgreich (keine Fehler)
- [x] `npx next build` erfolgreich
- [x] Alle Routen prerendered

### ⚠️ Offen / ToDo
- [ ] API-Key in `.env.local` auf Produktionsserver eintragen
- [ ] Erster vollständiger Sync ausführen (14.100 Dokumente)
- [ ] Alte Views/Materialized Views neu erstellen (wurden gelöscht)
  - `tms.partner_item_revenue_monthly`
  - `tms.partner_item_margin_monthly`
  - `tms.mv_partner_monthly_revenue`
  - `tms.mv_dashboard_monthly_revenue`
  - `tms.partner_revenue_monthly`
  - `tms.partner_revenue_summary`

---

## Tests durchgeführt

| Test | Ergebnis | Datum |
|------|---------|-------|
| Datenbank-Migration | ✅ OK | 2026-07-09 |
| API-Verbindung (1 Request) | ✅ OK | 2026-07-09 |
| Build | ✅ OK | 2026-07-09 |
| TypeScript Check | ✅ OK | 2026-07-09 |
| Richtiger Sync (ab 2023) | ⏳ Offen | — |

---

## Bekannte Einschränkungen

1. **Alte Views gelöscht:** Beim DROP TABLE wurden auch abhängige Views/Materialized Views gelöscht. Diese müssen bei Bedarf neu erstellt werden.
2. **Erster Sync braucht Zeit:** Bei ~14.100 Dokumenten mit ~10 Positionen pro Dokument kann der erste Sync 1-2 Stunden dauern.
3. **Zahlungen werden noch nicht mitgeladen:** Der Sync-Script lädt Zahlungen, aber der Standalone-Test nicht. Muss im realen Sync verifiziert werden.

---

## Nächste Schritte

1. API-Key auf Produktionsserver in `.env.local` eintragen
2. Ersten vollständigen Sync starten
3. Ergebnis verifizieren (Anzahl Dokumente in DB)
4. Alte Views bei Bedarf neu erstellen
5. Feature auf "Deployed" setzen
