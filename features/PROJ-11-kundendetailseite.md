# PROJ-11: Kundendetailseite (erweitert)

**Status:** Spec geschrieben — wartet auf Review/Approval  
**Projekt:** TMS 2.0  
**Priorität:** Hoch  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-02

---

## 1. Problem-Statement

Die aktuelle Kundenseite zeigt nur Stammdaten. Es fehlen wichtige Geschäftsinformationen: Umsatz, Bestellhistorie und Kontakte. Adressen sind nur lesbar, nicht bearbeitbar.

**Werkstatt-Vergleich:** Stell dir vor, du hast eine Karteikarte mit Name und Adresse — aber keinen Überblick, was der Kunde umsetzt, was er bestellt hat, und wer dort Ansprechpartner ist. Und wenn sich die Lieferadresse ändert, kannst du sie nicht nachträglich korrigieren.

---

## 2. Anforderungen

### 2.1 Kunden-Stammdaten (bereits deployed → wird erweitert)

Bereits vorhanden und bleibt erhalten:
- Firmenname, Ansprechpartner
- Telefon, E-Mail (anklickbar)
- USt-ID, Steuernummer

### 2.2 Adressen (mit Edit-Funktion)

**Zwei Adress-Karten:**
- **Rechnungsadresse** (aus `partner_addresses` mit `address_type = 'billing'`)
- **Lieferadresse** (aus `partner_addresses` mit `address_type = 'shipping'`)

**Edit-Modus:**
- "Bearbeiten"-Button auf jeder Adress-Karte
- Öffnet Modal mit Formular
- Felder: Firma, Vorname, Nachname, Straße, Zusatz, PLZ, Ort, Land
- Speichern → Update in `partner_addresses` (SSOT = Supabase)
- Abbrechen → Keine Änderung

### 2.3 Umsatz-Anzeige

**Balkendiagramm:**
- Monatsumsätze (Jan–Dez)
- Gesplittet in: Handelsware, Service, Sonderwerkzeug
- Farben: Handelsware = Blau, Service = Grün, Sonderwerkzeug = Orange
- Datenquelle: `mv_partner_monthly_revenue`

**Jahres-Switch:**
- Dropdown oben rechts im Diagramm
- Verfügbare Jahre dynamisch aus der Datenbank
- Standard: aktuelles Jahr

**Werte-Anzeige:**
- Umsatz pro Kategorie + Gesamt pro Monat
- Summe des ausgewählten Jahres
- Anzahl Rechnungen

### 2.4 Bestellhistorie (NUR Trade Goods)

**Wichtig:** Nur Rechnungspositionen (`invoice_items`) mit `revenue_category = 'trade'` (Handelsware). Keine Service-Leistungen, keine Sonderwerkzeuge.

**Tabellen-Spalten:**
| Spalte | Quelle |
|--------|--------|
| Datum | `invoices.document_date` |
| Rechnungsnr. | `invoices.document_number` |
| Beschreibung | `invoice_items.title` oder `invoice_items.description` |
| Artikelnr. | `invoice_items.item_number` |
| Menge | `invoice_items.quantity` |
| Einzelpreis | `invoice_items.unit_price` |
| Rabatt % | `invoice_items.discount` |
| Gesamtpreis | `invoice_items.total_price` |
| EK-Preis | `invoice_items.cost_price` (falls vorhanden) |

**Filter:**
- Zeitraum (letzte 3 Monate / letztes Jahr / alle)
- Suche nach Artikelnummer oder Beschreibung

**Sortierung:** Neueste zuerst

### 2.5 Kontakte

**Liste verknüpfter Kontakte** (aus `partner_contacts`):
- Name, Vorname
- E-Mail (anklickbar)
- Handynummer (anklickbar)
- Position in der Firma
- Notizen

**Kontakt hinzufügen:**
- "+" Button neben der Kontaktliste
- Modal mit Formular
- Felder: Name, Vorname, E-Mail, Handynummer, Position, Notizen
- Speichern → Insert in `partner_contacts`

---

## 3. UI/UX — Tabs + Bento Grid

**Layout: Tabs oben, Bento Grid in jedem Tab**

### Tab: Übersicht (Standard)

**Bento Grid — obere Reihe:**
- **Karte 1 (links, breit):** Stammdaten — Firmenname, Telefon, E-Mail, USt-ID
- **Karte 2 (mitte):** Rechnungsadresse mit "Bearbeiten"-Button
- **Karte 3 (rechts):** Lieferadresse mit "Bearbeiten"-Button

**Bento Grid — untere Reihe:**
- **Karte 4 (breit):** Kontaktliste mit "+" Button

### Tab: Umsatz

**Bento Grid:**
- **Karte 1 (groß, breit):** Balkendiagramm mit Jahres-Dropdown
- **Karte 2 (unten):** Summen-Karte (Gesamtumsatz, Anzahl Rechnungen)

### Tab: Bestellhistorie

**Bento Grid:**
- **Karte 1 (vollbreit):** Tabelle mit Filter + Suchleiste

---

## 4. Akzeptanzkriterien

### Stammdaten & Adressen
- [ ] Alle Stammdaten werden korrekt angezeigt
- [ ] Rechnungsadresse wird aus `partner_addresses` geladen
- [ ] Lieferadresse wird aus `partner_addresses` geladen
- [ ] "Bearbeiten"-Button öffnet Modal
- [ ] Adress-Änderungen werden in Supabase gespeichert
- [ ] Nach Speichern wird die Ansicht aktualisiert

### Umsatz
- [ ] Balkendiagramm zeigt 12 Monate
- [ ] Drei Farben für Handel/Service/Sonderwerkzeug
- [ ] Dropdown zeigt alle verfügbaren Jahre
- [ ] Jahreswechsel aktualisiert Diagramm sofort
- [ ] Summen werden korrekt angezeigt
- [ ] Responsive: Diagramm passt sich an

### Bestellhistorie
- [ ] NUR Trade Goods (keine Service/Sonderwerkzeug)
- [ ] Alle Spalten korrekt befüllt
- [ ] Filter nach Zeitraum funktioniert
- [ ] Suche nach Artikel/Beschreibung funktioniert
- [ ] Sortierung: Neueste zuerst
- [ ] Paginierung: 20 pro Seite

### Kontakte
- [ ] Alle verknüpften Kontakte werden angezeigt
- [ ] "+" Button öffnet Modal
- [ ] Neuer Kontakt wird in `partner_contacts` gespeichert
- [ ] Nach Speichern wird Liste aktualisiert
- [ ] Telefon/E-Mail sind anklickbar

### Allgemein
- [ ] Tabs funktionieren auf Desktop, Tablet und Mobile
- [ ] Bento Grid Layout auf Desktop
- [ ] Stacked Layout auf Mobile
- [ ] Animationen bei Tab-Wechsel und Modal-Öffnung
- [ ] Keine Console-Fehler
- [ ] Ladezustände (Skeleton) während Daten geladen werden

---

## 5. Technische Details

### Neue Dateien:
```
src/
  app/
    kunden/
      [id]/
        page.tsx                    # Hauptseite mit Tabs
      [id]/
        components/
          customer-header.tsx       # Kopfzeile mit Name + Status
          address-card.tsx          # Adress-Karte mit Edit-Button
          address-edit-modal.tsx    # Modal für Adress-Edit
          revenue-chart.tsx         # Balkendiagramm (Recharts)
          revenue-year-selector.tsx # Jahres-Dropdown
          order-history-table.tsx   # Bestellhistorie-Tabelle
          order-history-filters.tsx # Filter für Bestellhistorie
          contacts-list.tsx         # Kontaktliste
          contact-add-modal.tsx     # Modal für neuen Kontakt
          tab-container.tsx         # Tab-Container mit Animation
          bento-grid.tsx            # Bento Grid Layout
  lib/
    actions/
      addresses.ts                  # Update Adresse
      contacts.ts                   # Create Kontakt
      revenue.ts                    # Fetch Umsatz-Daten
      orders.ts                     # Fetch Bestellhistorie
```

### Datenbank-Abfragen:

**Adressen:**
```sql
SELECT * FROM tms.partner_addresses
WHERE partner_id = :id AND address_type = 'billing' AND is_default = true
```

**Umsatz (Materialized View):**
```sql
SELECT * FROM tms.mv_partner_monthly_revenue
WHERE partner_id = :id AND year = :year
ORDER BY month
```

**Bestellhistorie (NUR Trade):**
```sql
SELECT 
  i.document_date,
  i.document_number,
  ii.title,
  ii.item_number,
  ii.quantity,
  ii.unit_price,
  ii.discount,
  ii.total_price,
  ii.cost_price
FROM tms.invoice_items ii
JOIN tms.invoices i ON ii.invoice_id = i.id
WHERE i.partner_id = :id
  AND ii.revenue_category = 'trade'
ORDER BY i.document_date DESC
```

**Kontakte:**
```sql
SELECT * FROM tms.partner_contacts
WHERE partner_id = :id
ORDER BY created_at DESC
```

### RLS:
- Alle Nutzer können Adressen **lesen**
- Admin/AV können Adressen **bearbeiten**
- Alle Nutzer können Umsatz/Bestellhistorie **lesen**
- Alle Nutzer können Kontakte **lesen**
- Admin/AV können Kontakte **anlegen**

### Libraries:
- **Recharts** für Balkendiagramm (bereits in `package.json`)
- **Framer Motion** für Animationen (Tabs, Modals, Bento Grid)
- **shadcn/ui** Tabs, Dialog, Table, Select

---

## 6. Zeitschätzung

| Task | Zeit |
|------|------|
| Spec | 30 Min (gemacht) |
| Architektur | 30 Min |
| Frontend (Tabs + Bento Grid) | 3 Stunden |
| Frontend (Adress-Edit Modal) | 2 Stunden |
| Frontend (Umsatz-Diagramm) | 2.5 Stunden |
| Frontend (Bestellhistorie) | 2 Stunden |
| Frontend (Kontakte) | 1.5 Stunden |
| Backend (Actions) | 2 Stunden |
| Tests | 1.5 Stunden |
| **Gesamt** | **~1.5 Tage** |

---

## 7. Abhängigkeiten

- ✅ PROJ-1 (Auth) — erledigt
- ✅ PROJ-2a.1 (Kunden-Stammdaten) — erledigt
- ✅ Tabellen `partners`, `partner_addresses`, `partner_contacts`, `invoices`, `invoice_items` — existieren
- ✅ Materialized View `mv_partner_monthly_revenue` — existiert

---

## 8. Nächste Schritte

1. **Diese Spec reviewen** — Jan Bernd prüft und gibt "approved"
2. **/architecture** — Technische Details finalisieren
3. **/frontend + /backend** — Bauen
4. **/qa** — Tests
5. **/deploy** — Auf Server deployen

---

*Diese Spec folgt dem Workflow aus MEMORY.md: /init → /write-spec → User-Review → /architecture → /frontend → /backend → /qa → /deploy*
