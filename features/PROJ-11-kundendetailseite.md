# PROJ-11: Kundendetailseite (erweitert)

**Status:** 🔵 Planned — Umsatz-Tab-Neubau (Spec, wartet auf „approved"). Bestellhistorie-Erweiterung weiterhin ✅ Deployed (2026-07-18), siehe Abschnitt „Deploy-Verlauf 2026-07-18"  
**Projekt:** TMS 2.0  
**Priorität:** Hoch  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-02 (Erweiterung Bestellhistorie: 2026-07-17, Neubau Umsatz-Tab: 2026-07-21)

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

### 2.3 Umsatz-Anzeige (Neubau 2026-07-21)

**Werkstatt-Vergleich:** Bisher hing das Umsatz-Brett an einer Wand, die es
in der Werkstatt gar nicht gibt (`mv_partner_monthly_revenue` existiert
nicht in Produktion — der Tab zeigte im Live-Test nur einen Fehler). Wir
bauen das Brett jetzt direkt auf dem echten Lagerbestand auf: den
Rechnungspositionen (`invoice_items`), genau wie schon bei der
Bestellhistorie. Jede Position wird — wo möglich — ihrem Artikel und
darüber einer Warengruppe zugeordnet; diese Warengruppe ist bei TMS
zugleich die "Rabattgruppe", weil pro Kunde und Warengruppe ein
Rabattsatz hinterlegt ist (PROJ-26).

**Wichtiger Kurswechsel gegenüber der alten Spec:** Die alte Drei-Farben-
Aufteilung (Handelsware/Service/Sonderwerkzeug) basierte auf
`invoice_items.revenue_category` — diese Spalte ist zu 100% `NULL` und
war nie nutzbar. Ab jetzt gilt durchgängig dieselbe Klassifizierung wie in
der Bestellhistorie (Abschnitt 2.4.1): `products.type = 'PRODUCT'` →
Handelsware, `products.type = 'SERVICE'` → Service. "Sonderwerkzeug" als
eigene Kategorie entfällt ersatzlos (keine verlässliche Datenquelle dafür).

#### Datengrundlage

- **Basis:** `tms.invoice_items`, direkt abgefragt (keine Materialized
  View für Live-Werte auf der Detailseite) — analog zum bereits deployten
  Muster in `orders.ts` (`invoice_items.article_number ↔ products.number`,
  Preise in Cent → `centsToEuro()`).
- **Klassifizierung:** Join zu `tms.products` liefert `type`
  (PRODUCT/SERVICE) und `group_id` → `tms.position_groups` (Warengruppe =
  Rabattgruppe). Positionen ohne Produkt-Match bleiben **im
  Gesamtumsatz enthalten**, fehlen aber in der Handel/Service-Aufteilung
  und in der Rabattgruppen-Aufteilung (siehe „Nicht zugeordnet" unten).
- **Jahresumsatz-Definition (wichtig, siehe Decision Log):**
  **Gesamtumsatz = Summe ALLER `invoice_items` des Kunden im gewählten
  Zeitraum**, unabhängig von Produkt-Zuordnung. Diese Zahl ist die
  „amtliche" Jahresumsatz-Kennzahl und wird an anderer Stelle (z.B.
  Kundenliste, künftige Auswertungen) wiederverwendet — sie darf durch
  fehlende Artikel-Stammdaten nicht künstlich sinken.
- **Persistenz:** Neue Materialized View `tms.mv_partner_revenue`
  (diesmal als **echte, getrackte Migration** in `supabase/migrations/`,
  nicht wie die alte View nur „in Produktion vorhanden"), aggregiert pro
  Kunde × Monat × Jahr: Gesamtumsatz, Handelsumsatz, Serviceumsatz,
  nicht zugeordneter Umsatz, sowie Umsatz je Rabattgruppe. Refresh:
  nächtlich (z.B. `pg_cron` oder Deploy-Hook — Detail-Entscheidung im
  `/architecture`-Schritt). Das rollierende 365-Tage-Fenster wird aus den
  Monats-/Tageswerten der View berechnet, nicht separat materialisiert.

#### KPI-Karten (oberer Bereich, dynamisch)

| KPI | Beschreibung |
|-----|--------------|
| **Gesamtumsatz** (Hauptfokus, größte Karte) | Summe aller `invoice_items` im gewählten Zeitraum |
| **Handelsumsatz** | Summe `products.type = 'PRODUCT'` im Zeitraum — anklickbar (filtert Chart) |
| **Serviceumsatz** | Summe `products.type = 'SERVICE'` im Zeitraum — anklickbar (filtert Chart) |
| **Nicht zugeordnet** | Differenz Gesamtumsatz − (Handel + Service); nur sichtbar wenn > 0 |
| **Anzahl Rechnungen** | Distinct `invoices.id` im Zeitraum |
| **Ø Bestellwert** | Gesamtumsatz ÷ Anzahl Rechnungen im Zeitraum |

Jede KPI-Karte (außer „Nicht zugeordnet") zeigt zusätzlich eine
**Vergleichs-Badge** zur Vorperiode (grün bei Zuwachs, rot bei Rückgang,
in %):
- Zeitraum „Letzte 12 Monate" (rollierend) → Vergleich mit den 365 Tagen
  davor
- Zeitraum Kalenderjahr (z.B. 2025) → Vergleich mit dem kompletten Vorjahr
  (2024)
- Zeitraum „Gesamt" → **keine Vergleichs-Badge** (keine sinnvolle Baseline)

#### Chart (dynamisch, unterhalb der KPIs)

- **Standard (keine KPI angeklickt):** Gestapeltes Monats-Balkendiagramm,
  zwei Kategorien: Handelsware / Service (Farben aus dem Design-System,
  siehe Bestellhistorie-Palette)
- **Klick auf KPI „Handelsumsatz":** Chart zeigt nur Handelsumsatz pro
  Monat, gesplittet nach Rabattgruppe (`position_groups`) — ein
  Balkensegment pro Gruppe, gleiches Interaktionsmuster wie das
  Donut-Chart in der Bestellhistorie (Toggle: erneuter Klick auf die
  aktive KPI hebt den Filter wieder auf)
- **Klick auf KPI „Serviceumsatz":** analog, nur Serviceumsatz gesplittet
  nach Rabattgruppe
- Chart-Zeitachse passt sich an den gewählten Zeitraum an: 12 Monate
  rollierend, 12 Monate eines Kalenderjahres, oder — bei „Gesamt" —
  Jahres-Balken statt Monats-Balken (sonst unleserlich bei mehreren
  Jahren Historie)

#### Zeitraum-Dropdown

- **Default: „Letzte 12 Monate"** (rollierend, heute − 365 Tage bis
  heute) — im UI bewusst NICHT „YTD" genannt, um Verwechslung mit
  Kalenderjahr-YTD zu vermeiden
- **Kalenderjahre**, dynamisch aus der Datenbank (ältestes Jahr mit
  Rechnungsdaten bis aktuelles Jahr, absteigend sortiert)
- **„Gesamt"** — gesamter gespeicherter Zeitraum aller `invoice_items`
  des Kunden, keine Vergleichs-Badge, Chart wechselt auf Jahres-Balken

#### Edge Cases

- Kunde ohne jegliche `invoice_items` → alle KPIs zeigen 0, Chart zeigt
  Leerzustand, keine Vergleichs-Badges
- Kunde mit Umsatz nur im Vorperioden-Zeitraum, aber 0 im aktuellen →
  Vergleichs-Badge zeigt „-100%" (rot), kein Absturz durch Division durch 0
  im aktuellen Zeitraum (Vergleich wird umgekehrt: Basis ist immer die
  Vorperiode)
- Vorperiode selbst = 0 (z.B. Neukunde) → keine Prozent-Badge anzeigen
  (Division durch 0 vermeiden), stattdessen Hinweis „neu" o.ä.
- Rabattgruppen-Chart bei Klick auf Handel/Service-KPI, aber Kunde hat
  Positionen ohne Gruppen-Zuordnung → zusätzliches Segment „Ohne Gruppe"

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

#### 2.4.1 Produkttyp-Filter, Gruppierung & Donut-Chart (Erweiterung 2026-07-17)

**Werkstatt-Vergleich:** Bisher liegt jedes bestellte Teil einzeln in der
Bestellhistorie-Kiste. Jetzt bekommt jedes Teil zusätzlich ein Fach-Etikett
(Artikelgruppe) und wir stellen eine kleine Übersichtstafel (Donut-Chart)
davor, die zeigt, wie viele Teile in welchem Fach liegen — ein Klick auf ein
Tortenstück zeigt nur die Teile aus diesem Fach.

**Zusätzlicher Filter — nur echte Handelsartikel:**
- Verknüpfung: `invoice_items.article_number = tms.products.number`
- Nur Positionen anzeigen, deren verknüpfter Artikel `tms.products.type = 'PRODUCT'` ist (nicht `'SERVICE'`)
- Positionen ohne passenden Eintrag in `tms.products` werden **ausgeblendet** (kein Match = keine Anzeige)

**Gruppierung:**
- Jeder Artikel gehört über `tms.products.group_id` zu einer `tms.position_groups`-Gruppe (`name`, `number`, `display_name`)
- Bestellpositionen werden dieser Gruppe zugeordnet und in der Tabelle danach gruppiert/gefiltert

**Donut-Chart (neue Bento-Karte über der Tabelle):**
- Ein Segment pro Artikelgruppe, die beim jeweiligen Kunden tatsächlich vorkommt
- Kennzahl je Segment: **Anzahl Bestellpositionen** dieser Gruppe (Anzahl der Rechnungszeilen, nicht Mengen-Summe)
- Klick auf ein Segment filtert die Tabelle darunter auf diese Gruppe
- Erneuter Klick auf dasselbe (bereits aktive) Segment hebt den Filter wieder auf (Toggle)

**Zusätzlicher Dropdown-Filter:**
- Dropdown "Artikelgruppe" neben dem bestehenden Zeitraum-/Suchfilter
- Zeigt nur Gruppen an, die bei diesem Kunden in den (produkttyp-gefilterten) Bestellpositionen vorkommen — keine leeren Gruppen
- Dropdown und Donut-Chart sind synchronisiert (Auswahl im einen Element spiegelt sich im anderen)
- Option "Alle" setzt den Filter zurück

**Edge Cases:**
- Kunde hat keine Positionen mit `type = 'PRODUCT'` → Donut-Chart zeigt Leerzustand, Tabelle zeigt bestehenden "Keine Bestellungen gefunden"-Zustand
- Artikel ohne `group_id` (keine Gruppe zugeordnet) → wird nicht im Donut-Chart/Dropdown geführt, aber weiterhin in der Tabelle sichtbar (falls kein anderer Filter aktiv ist)

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

### Tab: Umsatz (Neubau 2026-07-21)

**Bento Grid:**
- **Kopfzeile:** Zeitraum-Dropdown (Letzte 12 Monate / Kalenderjahre / Gesamt)
- **Karte 1 (KPI-Reihe, volle Breite):** Gesamtumsatz (groß), Handelsumsatz,
  Serviceumsatz, Ø Bestellwert, Anzahl Rechnungen — je mit
  Vergleichs-Badge; „Nicht zugeordnet" nur wenn > 0
- **Karte 2 (groß, breit, darunter):** Chart — dynamisch je nach
  KPI-Auswahl (Standard: Handel/Service gestapelt; bei Klick auf
  Handel/Service-KPI: Rabattgruppen-Split)

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

### Umsatz (Neubau 2026-07-21)
- [ ] Datenquelle: direkte `invoice_items`-Abfrage bzw. neue, per Migration
  getrackte `mv_partner_revenue` — **nicht** die alte
  `mv_partner_monthly_revenue`
- [ ] Gesamtumsatz-KPI zählt ALLE `invoice_items` im Zeitraum (auch ohne
  Produkt-Match) — nicht künstlich niedriger als der tatsächliche
  Rechnungsumsatz
- [ ] Handelsumsatz = `products.type = 'PRODUCT'`, Serviceumsatz =
  `products.type = 'SERVICE'` (keine „Sonderwerkzeug"-Kategorie mehr)
- [ ] „Nicht zugeordnet"-KPI erscheint nur wenn > 0
- [ ] Default-Zeitraum: „Letzte 12 Monate" (rollierend, heute − 365 Tage)
- [ ] Dropdown zeigt dynamisch alle Kalenderjahre mit Daten + „Gesamt"
- [ ] Zeitraumwechsel aktualisiert KPIs + Chart sofort
- [ ] Vergleichs-Badge korrekt: rollierend → Vorperiode (365 Tage davor),
  Kalenderjahr → Vorjahr, „Gesamt" → keine Badge
- [ ] Vergleichs-Badge: grün bei Zuwachs, rot bei Rückgang, kein Absturz
  bei Vorperiode = 0
- [ ] Klick auf KPI „Handelsumsatz" filtert Chart auf Handelsumsatz,
  gesplittet nach Rabattgruppe; erneuter Klick hebt Filter auf (Toggle)
- [ ] Klick auf KPI „Serviceumsatz" filtert Chart analog nach Rabattgruppe
- [ ] Ø Bestellwert und Anzahl Rechnungen korrekt berechnet
- [ ] Responsive: KPI-Reihe und Chart passen sich an (Mobile: KPIs
  gestapelt)

### Bestellhistorie
- [ ] NUR Trade Goods (keine Service/Sonderwerkzeug)
- [ ] Alle Spalten korrekt befüllt
- [ ] Filter nach Zeitraum funktioniert
- [ ] Suche nach Artikel/Beschreibung funktioniert
- [ ] Sortierung: Neueste zuerst
- [ ] Paginierung: 20 pro Seite
- [ ] Nur Positionen mit verknüpftem `products.type = 'PRODUCT'` werden angezeigt; Positionen ohne Produkt-Match werden ausgeblendet
- [ ] Donut-Chart zeigt genau die Artikelgruppen, die beim Kunden vorkommen (keine leeren Gruppen)
- [ ] Donut-Chart-Segment = Anzahl Bestellpositionen dieser Gruppe
- [ ] Klick auf Segment filtert Tabelle korrekt; erneuter Klick auf gleiches Segment hebt Filter wieder auf
- [ ] Dropdown-Filter "Artikelgruppe" und Donut-Chart bleiben synchron
- [ ] Dropdown zeigt "Alle" zum Zurücksetzen
- [ ] Kunde ohne `type=PRODUCT`-Positionen: Donut-Chart und Tabelle zeigen sauberen Leerzustand, kein Fehler

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
          revenue-kpi-cards.tsx     # KPI-Karten (Gesamt/Handel/Service/Ø/Anzahl) mit Vergleichs-Badge
          revenue-chart.tsx         # Balkendiagramm (Recharts), dynamisch: Kategorie- oder Rabattgruppen-Split
          revenue-period-selector.tsx # Zeitraum-Dropdown (Letzte 12 Monate / Kalenderjahre / Gesamt)
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

**Umsatz (Neubau 2026-07-21 — direkt aus `invoice_items`, KEINE alte View mehr):**

Gesamt- und Kategorie-Summen für einen Zeitraum (rollierend, Kalenderjahr
oder „Gesamt"), analog zum Bestellhistorie-Muster (`article_number ↔
products.number`, Cent → Euro):
```sql
SELECT
  ii.total_price_net,
  p.type AS product_type,
  pg.id AS group_id,
  pg.name AS group_name,
  i.document_date
FROM tms.invoice_items ii
JOIN tms.invoices i ON ii.invoice_id = i.id
LEFT JOIN tms.products p ON p.number = ii.article_number
LEFT JOIN tms.position_groups pg ON pg.id = p.group_id
WHERE i.partner_id = :id
  AND i.document_date BETWEEN :from AND :to
```
Aggregation (Summe gesamt, Summe je `product_type`, Summe je
`group_id` innerhalb PRODUCT/SERVICE) erfolgt in der App-Schicht
(`revenue.ts`), analog zu `buildGroupStats` in `orders-helpers.ts`.

**Neue Materialized View `tms.mv_partner_revenue` (getrackte Migration,
nächtlicher Refresh):**
```sql
CREATE MATERIALIZED VIEW tms.mv_partner_revenue AS
SELECT
  i.partner_id,
  date_trunc('month', i.document_date) AS month,
  SUM(ii.total_price_net) AS revenue_total,
  SUM(ii.total_price_net) FILTER (WHERE p.type = 'PRODUCT') AS revenue_product,
  SUM(ii.total_price_net) FILTER (WHERE p.type = 'SERVICE') AS revenue_service,
  pg.id AS group_id,
  SUM(ii.total_price_net) FILTER (WHERE pg.id IS NOT NULL) AS revenue_group,
  COUNT(DISTINCT i.id) AS invoice_count
FROM tms.invoice_items ii
JOIN tms.invoices i ON ii.invoice_id = i.id
LEFT JOIN tms.products p ON p.number = ii.article_number
LEFT JOIN tms.position_groups pg ON pg.id = p.group_id
GROUP BY i.partner_id, date_trunc('month', i.document_date), pg.id;
```
*(Finale Spaltenaufteilung/Indizes werden im `/architecture`-Schritt
festgelegt — hier nur das fachliche Aggregationsprinzip.)*

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

**Bestellhistorie — Produkttyp-Filter + Gruppierung (Erweiterung):**
```sql
SELECT
  ii.*,
  p.type AS product_type,
  pg.id AS group_id,
  pg.name AS group_name
FROM tms.invoice_items ii
JOIN tms.invoices i ON ii.invoice_id = i.id
JOIN tms.products p ON p.number = ii.article_number
LEFT JOIN tms.position_groups pg ON pg.id = p.group_id
WHERE i.partner_id = :id
  AND ii.revenue_category = 'trade_goods'
  AND p.type = 'PRODUCT'
ORDER BY i.document_date DESC
```
Referenz-Implementierungen für Produkt-/Gruppen-Zugriff bereits vorhanden in
`src/lib/actions/manufacturers.ts` (`getProducts()`, `getPositionGroups()`,
Typen `ProductWithManufacturer`, `PositionGroup`) — im Backend-Schritt
wiederverwenden statt duplizieren.

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
- ✅ Tabellen `partners`, `partner_addresses`, `partner_contacts`, `invoices`, `invoice_items` — existieren (nur in Produktion, nicht in `supabase/migrations/` getrackt — bekanntes Schema-Drift-Risiko)
- ✅ PROJ-28 (`tms.products`, `tms.position_groups`) — existiert, bereits von Bestellhistorie genutzt
- ✅ PROJ-26 (`tms.partner_discounts` — Kunde × Rabattgruppe) — existiert, Grundlage für „Rabattgruppen" im Umsatz-Tab
- ❌ Materialized View `mv_partner_monthly_revenue` — **existiert NICHT in Produktion**, war Ursache des Deploy-Rollbacks 2026-07-18. Wird durch Neubau in Abschnitt 2.3 ersetzt (direkte Abfrage + neue, getrackte `mv_partner_revenue`).

---

## 8. Nächste Schritte

1. **Diese Spec reviewen** — Jan Bernd prüft und gibt "approved"
2. **/architecture** — Technische Details finalisieren
3. **/frontend + /backend** — Bauen
4. **/qa** — Tests
5. **/deploy** — Auf Server deployen

---

## 9. Decision Log

### Produkt (2026-07-21 — Refine: Umsatz-Tab Neubau)
- **Auslöser:** `mv_partner_monthly_revenue` existiert nicht in Produktion
  (Deploy-Rollback 2026-07-18) — der komplette Umsatz-Tab war seit dem
  ersten Deploy funktionsunfähig. Statt die alte View nachträglich
  anzulegen, wird die Datengrundlage auf direkte `invoice_items`-Abfragen
  umgestellt (analog zur bereits funktionierenden Bestellhistorie).
- **„Letzte 12 Monate" statt „YTD" als Default:** rollierendes
  365-Tage-Fenster (heute − 365 Tage), NICHT Kalender-YTD (1. Januar bis
  heute) — bewusst anders benannt im UI, um Verwechslung mit den
  ebenfalls wählbaren Kalenderjahren zu vermeiden.
- **Gesamtumsatz zählt ALLE `invoice_items`**, auch ohne Produkt-Match —
  da diese Kennzahl laut User an anderer Stelle wiederverwendet wird und
  nicht durch fehlende Artikel-Stammdaten künstlich sinken darf. Handel/
  Service-Split ist eine Teilmengen-Aufteilung dieser Gesamtzahl, keine
  eigene Quelle der Wahrheit.
- **„Sonderwerkzeug" als dritte Kategorie entfällt** (basierte auf der
  zu 100% `NULL`-en Spalte `revenue_category`, nie nutzbar). Nur noch
  Handelsware/Service, konsistent mit Bestellhistorie.
- **„Rabattgruppen" = `tms.position_groups`**, dieselbe Dimension wie die
  „Artikelgruppen" in der Bestellhistorie, verknüpft über
  `invoice_items.article_number → products.number → products.group_id`.
  Genannt „Rabattgruppe" im Umsatz-Kontext, weil PROJ-26 pro Kunde ×
  Gruppe einen Rabattsatz in `tms.partner_discounts` hinterlegt — keine
  neue Tabelle, nur andere Bezeichnung derselben Gruppierung.
- **Zusätzliche KPIs vorgeschlagen und übernommen:** „Anzahl Rechnungen"
  und „Ø Bestellwert" wurden im Refine als sinnvolle Ergänzung
  identifiziert (User hatte explizit nach weiteren Kennzahlen gefragt)
  und in die Spec aufgenommen — siehe Open Questions zur finalen
  Bestätigung.

### Technisch (2026-07-21 — Umsatz-Tab Neubau)
- **Persistenz über neue, getrackte Materialized View
  `tms.mv_partner_revenue`** statt Live-Aggregation bei jedem Request —
  wichtig, da der Jahresumsatz auch in Listen-/Sortier-Abfragen
  (`getPartnersWithRevenue`) verwendet wird, wo eine Live-Berechnung pro
  Zeile zu langsam wäre. Anders als die alte View wird diese **als
  Migration in `supabase/migrations/` ausgeliefert** — das war die
  eigentliche Ursache des Deploy-Rollbacks am 2026-07-18 (View „existierte"
  nur als Annahme in Spec/Code, nie als echte DB-Migration).
- **Refresh-Strategie (nächtlich)** wird im `/architecture`-Schritt
  konkretisiert (`pg_cron` vs. Deploy-Hook vs. externer Scheduler) — hier
  nur als Anforderung festgehalten.
- Wiederverwendung der bestehenden `article_number ↔ products.number`
  Join-Logik und Cent→Euro-Konvertierung aus `orders.ts`, um keine zweite,
  abweichende Implementierung derselben Verknüpfung zu erzeugen.

### Produkt (2026-07-17 — Refine: Bestellhistorie Produkttyp/Gruppierung/Donut-Chart)
- **Kennzahl im Donut-Chart:** Anzahl Bestellpositionen je Artikelgruppe (nicht Mengen-Summe). Begründung: User-Beispiel "10 mal ein HW Sägeblatt gekauft" bezieht sich auf Anzahl der Vorkommnisse, nicht auf Stückzahl je Position.
- **Segment-Klick-Verhalten:** Toggle — erneuter Klick auf aktives Segment hebt den Filter auf. Dropdown bietet zusätzlich "Alle" als expliziten Reset.
- **Umgang mit nicht matchbaren Artikeln:** Positionen ohne passenden `products`-Eintrag (kein `number`-Match zu `article_number`) werden ausgeblendet, da `type = 'PRODUCT'` sonst nicht verifizierbar ist.

### Technisch (2026-07-17)
- Verknüpfung `invoice_items.article_number = products.number` (Spaltennamen unterscheiden sich bewusst — kein Rename der Bestandstabellen).
- Gruppendaten kommen über `products.group_id` → `position_groups`, analog zur bestehenden Hersteller-Verwaltung (PROJ-28). Bestehende Actions in `manufacturers.ts` werden wiederverwendet.

## 10. Offene Fragen (zur Bestätigung vor "approved")

- [x] Kennzahl im Donut-Chart = Anzahl Bestellpositionen (nicht Mengen-Summe) → bestätigt (2026-07-17)
- [x] Toggle-Verhalten beim erneuten Klick auf ein aktives Segment → bestätigt (2026-07-17)
- [x] Ausblenden von Positionen ohne Produkt-Match (statt z.B. "unbekannt" anzuzeigen) → bestätigt (2026-07-17)
- [x] Default-Zeitraum = rollierende 365 Tage ("Letzte 12 Monate"), nicht Kalender-YTD → bestätigt (2026-07-21)
- [x] Gesamtumsatz zählt ALLE `invoice_items` (nicht nur produkt-zugeordnete) → bestätigt (2026-07-21)
- [x] Jahresumsatz-Persistenz über neue, getrackte Materialized View → bestätigt (2026-07-21)
- [x] "Sonderwerkzeug"-Kategorie entfällt ersatzlos → bestätigt (2026-07-21)
- [ ] Zusätzliche KPIs „Anzahl Rechnungen" und „Ø Bestellwert" — im Refine
  vorgeschlagen, noch nicht explizit vom User bestätigt. Vor „approved"
  final absegnen oder streichen.
- [ ] Refresh-Zyklus von `mv_partner_revenue` (nächtlich vorgesehen) —
  reicht das, oder muss der Umsatz nach frischem Easybill-Sync sofort
  aktuell sein? Falls ja: Refresh an bestehenden Sync-Job koppeln statt
  reinem Zeitplan (Detail-Entscheidung im `/architecture`-Schritt).
- [ ] Bekanntes Schema-Drift-Risiko: `invoice_items`, `invoices`,
  `products`, `position_groups`, `partner_discounts` existieren nur in
  Produktion, nicht in `supabase/migrations/`. Soll dieses Refine/die
  Folge-Architektur diese Lücke nachträglich schließen (Migrationen aus
  Ist-Zustand generieren), oder bleibt das ein separates Ticket?

---

## 11. Tech Design (Solution Architect) — Erweiterung Bestellhistorie (2026-07-17)

**Werkstatt-Vergleich:** Die bestehende Bestellhistorie-Kiste bekommt eine
neue Übersichtstafel davor (Donut-Chart) und ein zusätzliches
Sortier-Fach-Etikett (Artikelgruppe) an jeder Position. Die Kiste selbst
(Datenbank-Tabellen) bleibt unverändert — wir lesen nur zusätzliche
Informationen mit, die an anderer Stelle (Artikel-Stammdaten aus PROJ-28)
bereits vorhanden sind.

### A) Komponenten-Struktur

```
Tab: Bestellhistorie
├── Artikelgruppen-Übersicht (NEUE Karte, oberhalb der Tabelle)
│   ├── Donut-Chart — ein Tortenstück pro Artikelgruppe des Kunden
│   └── Dropdown "Artikelgruppe" — Alternative zum Klicken im Chart
├── Bestellhistorie-Tabelle (bestehend)
│   ├── Zeitraum-Filter (bestehend)
│   ├── Suchfeld (bestehend)
│   └── Zeilen — nur noch "echte" Handelsartikel (kein Werkzeug-Service)
```

Chart und Dropdown wirken auf denselben Filter-Zustand ("aktive
Artikelgruppe"): Klick im Chart setzt das Dropdown automatisch mit, und
umgekehrt. Ändert sich Zeitraum oder Suche, passt sich die Liste der im
Chart/Dropdown wählbaren Gruppen automatisch an (nur was beim Kunden gerade
vorkommt, wird angeboten).

### B) Datenmodell (fachlich)

Keine neuen Tabellen. Jede Bestellposition bekommt zwei zusätzliche
Informationen "angeheftet", die aus den bereits existierenden
Artikel-Stammdaten (PROJ-28) stammen:
- **Artikel-Art:** ist die Position ein "echter" Artikel oder eine
  Dienstleistung? Nur "echte Artikel" werden in der Bestellhistorie gezeigt.
- **Artikelgruppe:** zu welcher Warengruppe gehört der Artikel (z.B. "HW
  Sägeblatt")? Wird für die Gruppierung, das Donut-Chart und den
  Dropdown-Filter verwendet.

Für das Donut-Chart wird zusätzlich eine kleine Zusammenfassung berechnet:
pro Artikelgruppe, wie viele Bestellpositionen der Kunde insgesamt in dieser
Gruppe hat (nicht nur die aktuell sichtbare Tabellenseite, sondern über die
gesamte Historie des Kunden hinweg — sonst wäre die Übersichtstafel bei
Seitenwechsel irreführend).

Der ausgewählte Filter (welche Gruppe gerade aktiv ist) ist reiner
Anzeige-Zustand auf der Seite — er wird nirgends gespeichert und ist beim
nächsten Öffnen der Seite wieder zurückgesetzt.

### C) Tech-Entscheidungen (Begründung)

- **Wiederverwendung statt Neubau:** Die Verknüpfung "Bestellposition →
  Artikel-Stammdaten → Warengruppe" existiert bereits für die
  Hersteller-Verwaltung (PROJ-28). Wir nutzen dieselbe Verknüpfung, statt sie
  neu zu bauen — geringeres Risiko, konsistente Daten.
- **Filterung passiert serverseitig:** Wie bei den bestehenden Filtern
  (Zeitraum, Suche) wird die Artikelgruppen-Auswahl direkt in der
  Datenbank-Abfrage angewendet, nicht erst im Browser gefiltert. Das hält die
  Seite schnell, auch bei Kunden mit sehr vielen Bestellungen.
- **Übersichtstafel (Donut-Chart) = eigene, leichte Abfrage:** Damit die
  Kacheln im Chart die Gesamt-Häufigkeit zeigen (nicht nur die aktuelle
  Tabellenseite), wird dafür eine kleine, separate Zusammenfassungs-Abfrage
  je Kunde genutzt — dasselbe Muster, das für die bestehende
  Artikel/Dienstleistungs-Verteilung in der Hersteller-Verwaltung schon
  existiert.
- **Gleiches Chart-Erscheinungsbild wie bei den Herstellern:** Für das
  Donut-Chart wird dieselbe Diagramm-Bibliothek und derselbe visuelle Aufbau
  verwendet wie beim bereits bestehenden Artikel/Dienstleistungs-Diagramm in
  der Hersteller-Verwaltung — einheitliches Erscheinungsbild, keine neue
  Abhängigkeit nötig.

### D) Abhängigkeiten (Packages)

Keine neuen Packages nötig — Diagramm-Bibliothek und Dropdown-Baustein sind
bereits im Projekt vorhanden und werden nur wiederverwendet.

---

## 12. Technical Decisions (Architektur, 2026-07-17)

| Decision | Rationale | Date |
|----------|-----------|------|
| Gruppen-/Typ-Filterung serverseitig in der bestehenden Bestellhistorie-Abfrage ergänzen (kein neuer Endpoint für die Tabelle) | Konsistent mit bestehendem Zeitraum-/Suchfilter-Muster, keine doppelte Abfrage-Logik | 2026-07-17 |
| Donut-Chart-Zahlen über separate Zusammenfassungs-Abfrage (Gesamt-Historie, nicht Seiten-abhängig) | Chart muss unabhängig von Pagination korrekt bleiben | 2026-07-17 |
| Wiederverwendung der bestehenden Artikel/Gruppen-Verknüpfung aus der Hersteller-Verwaltung (PROJ-28) statt neuer Tabellen/Views | Vermeidet Datenduplikation, nutzt bereits vorhandene, geprüfte Verknüpfung | 2026-07-17 |
| Gleiches Donut-Chart-Erscheinungsbild wie im bestehenden Artikel/Dienstleistungs-Diagramm der Hersteller-Verwaltung | Visuelle Konsistenz, keine neue Bibliothek nötig | 2026-07-17 |

---

## 13. Implementierungsnotizen — Frontend (2026-07-17)

- `src/lib/actions/orders.ts`: `getPartnerTradeOrders` um `groupId`-Parameter,
  `group_id`/`group_name` im Ergebnis erweitert; neue Action
  `getPartnerOrderGroupStats(partnerId, search?)` für die Chart-/Dropdown-Daten.
  Verknüpfung `invoice_items.article_number ↔ products.number` erfolgt
  zweistufig in der App-Schicht (kein FK zwischen den Tabellen), analog zum
  bestehenden Muster in `manufacturers.ts`.
- Neue Komponente `order-group-chart.tsx` (Donut-Chart, Recharts,
  Design-System-Chartfarben `#FF6B6D · #4ECDC4 · #7C6CFF · #F59F00 · #4DABF7 · #2FB344`).
- `order-history-table.tsx` erweitert um Dropdown-Filter "Artikelgruppe" und
  Einbindung des Donut-Charts; Filter-Zustand (`activeGroupId`) synchron
  zwischen Chart, Dropdown und Tabellen-Query.
- Typecheck (`tsc --noEmit`) und Production-Build (`npm run build`) laufen
  fehlerfrei durch. **Kein Live-Browser-Test möglich** in dieser
  Sandbox-Umgebung (keine `.env.local`/Supabase-Zugangsdaten vorhanden) —
  muss im `/qa`-Schritt gegen echte Daten verifiziert werden.

---

## 14. Implementierungsnotizen — Backend (2026-07-17)

**Berechtigungsprüfung (`service_role` GRANTs), statt Neubau der Abfrage:**
- `tms.products` wird bereits von der deployten Hersteller-Verwaltung
  (PROJ-28, `src/lib/actions/manufacturers.ts`) über denselben
  `createAdminClient({ schema: "tms" })` gelesen **und beschrieben**
  (`updateProductManufacturer`, `bulkUpdateProductManufacturers` — live in
  Produktion). `tms.position_groups` wird dort ebenfalls gelesen
  (`getPositionGroups`, `getProductById`). Da PROJ-28 produktiv läuft, hat
  `service_role` für beide Tabellen bereits ausreichende Rechte — **keine
  neue GRANT-Migration nötig** (anders als bei BUG-2, wo `invoice_items`/
  `invoices` neu waren und noch keine Rechte hatten).
- Trotzdem **im `/qa`-Schritt gegen die echte Datenbank verifizieren**
  (Sandbox hat keinen DB-Zugriff): `SELECT * FROM tms.invoice_items ii JOIN
  tms.products p ON p.number = ii.article_number LIMIT 1;` mit
  `service_role` sollte Daten liefern, kein Permission-Fehler.

**Auth-Pattern konsistent mit bestehendem Code:**
- `getPartnerTradeOrders`/`getPartnerOrderGroupStats` haben — wie alle
  anderen Read-Actions in `revenue.ts`/`contacts.ts` — keine eigene
  Auth-Prüfung. Das ist konsistent: Routenschutz für `/kunden/[id]`
  erfolgt zentral über `src/lib/supabase/middleware.ts` (nicht
  angemeldet → Redirect `/login`). Keine Änderung nötig.

**Tests:** Für Server Actions mit `createAdminClient`-Zugriff existiert im
Projekt bisher keine Testinfrastruktur (nur `roles.test.ts` und
`validations/auth.test.ts` für reine Logik, kein Supabase-Mocking-Muster).
Ein neues Mocking-Setup nur für diese Erweiterung einzuführen wäre
Over-Engineering — die Verifikation erfolgt stattdessen im `/qa`-Schritt
gegen echte Daten (siehe Akzeptanzkriterien Abschnitt 4).

---

## QA Test Results — Erweiterung Bestellhistorie (Produkttyp/Gruppierung/Donut-Chart)

**Getestet:** 2026-07-17
**App-URL:** nicht erreichbar (keine `.env.local`/Supabase-Zugangsdaten in dieser
Sandbox — kein Login, kein Live-Browser-Test möglich)
**Tester:** QA Engineer (KI)

**Wichtiger Hinweis:** Ein echter Browser-Test gegen die Live-Anwendung
(`tms.gudel-werkzeuge.de` bzw. `localhost:3000` mit echten Kundendaten)
konnte in dieser Umgebung **nicht durchgeführt werden**. Stattdessen wurde
geprüft: Typecheck, Production-Build, automatisierte Unit-Tests, statische
Sicherheits-/Code-Review sowie Erstellung der E2E-Testsuite (unausgeführt).
**Alle unten als "ungeprüft" markierten Punkte müssen vor `/deploy` real
verifiziert werden** (z.B. während des `/deploy`-Skripts, das ohnehin einen
Playwright-Smoke-Test gegen die Live-URL fährt — dort aber nur Basis-Login,
nicht diese Feature-Details).

### Automatisierte Tests
- `npx tsc --noEmit`: ✅ keine Fehler
- `npm run build`: ✅ erfolgreich (Turbopack, alle Routen kompilieren)
- `npx vitest run src/`: ✅ 19/19 Tests grün (inkl. 4 neue Tests für
  `buildGroupStats` in `src/lib/actions/orders-helpers.test.ts`)
- **Vorbestehendes Problem gefunden (nicht durch dieses Feature verursacht):**
  `npm test` (= `vitest run`, ohne Pfad-Filter) versucht auch die
  Playwright-Specs unter `tests/` auszuführen und schlägt dort fehl, weil
  `vitest.config.ts` das `tests/`-Verzeichnis nicht ausschließt. Betrifft
  `tests/tms-kunden.spec.ts` und `tests/deploy/smoke.spec.ts` — beide
  bereits vor dieser Änderung vorhanden. **Nicht blockierend für PROJ-11**,
  sollte aber unabhängig behoben werden (Vorschlag: `exclude: ['tests/**']`
  in `vitest.config.ts`).
- Neue E2E-Testsuite `tests/PROJ-11-bestellhistorie-gruppen.spec.ts`
  geschrieben (3 Szenarien: Chart zeigt Gruppen, Klick filtert + synchronisiert
  Dropdown + Toggle, Dropdown "Alle" setzt zurück). `npx playwright test
  --list` bestätigt: Datei ist syntaktisch korrekt, 6 Testläufe
  (Chromium + Mobile Safari) werden erkannt. **Nicht ausgeführt** — erfordert
  echten Testkunden (`PROJ11_TEST_KUNDE_ID`) mit mehreren Artikelgruppen und
  echte Login-Zugangsdaten.

### Akzeptanzkriterien-Status (Abschnitt 4, "Bestellhistorie")

- [ ] **UNGEPRÜFT** (Live-Daten nötig) — Nur Positionen mit `products.type = 'PRODUCT'` werden angezeigt
- [ ] **UNGEPRÜFT** — Donut-Chart zeigt genau die vorkommenden Artikelgruppen
- [ ] **UNGEPRÜFT** — Donut-Chart-Segment = Anzahl Bestellpositionen
- [x] Klick-Toggle-Logik statisch geprüft (Code: `activeGroupId === groupId ? null : groupId`) — korrekt
- [x] Dropdown/Chart-Synchronisierung statisch geprüft (gemeinsamer State `activeGroupId`) — korrekt
- [ ] **UNGEPRÜFT** — Dropdown zeigt "Alle" zum Zurücksetzen (Code vorhanden, Live-Verhalten offen)
- [ ] **UNGEPRÜFT** — Leerzustand bei Kunde ohne `type=PRODUCT`-Positionen

### Gefundene Bugs

#### BUG-1: `groupId = 0` würde durch Truthy-Check ignoriert
- **Severity:** Low
- **Fundort:** `src/lib/actions/orders.ts`, `getProductGroupMap()`:
  `if (groupId) { query = query.eq("group_id", groupId); }`
- **Szenario:** Falls `tms.position_groups.id` jemals den Wert `0` annehmen
  könnte, würde der Gruppenfilter für genau diese Gruppe stillschweigend
  ignoriert (alle Gruppen würden angezeigt statt nur Gruppe 0).
- **Einschätzung:** Aktuell wahrscheinlich harmlos, da Postgres
  Identity/Serial-Spalten i.d.R. bei 1 starten — aber nicht verifiziert.
- **Fix-Vorschlag:** `if (groupId !== undefined)` statt Truthy-Check.
- **Priorität:** Vor Deployment beheben (einzeilig, geringes Risiko).
- **Status:** ✅ Behoben (2026-07-17) — `getProductGroupMap()` prüft jetzt `groupId !== undefined`.

#### BUG-2: Suchbegriff unescaped in PostgREST `.or()`-Filter (zweite Fundstelle)
- **Severity:** Medium
- **Fundort:** `getPartnerTradeOrders` UND neu `getPartnerOrderGroupStats` in
  `orders.ts`: `query.or(\`description.ilike.%${search}%,article_number.ilike.%${search}%\`)`
- **Szenario:** Der Suchbegriff wird ungeprüft in die PostgREST-Filter-DSL
  eingebettet. Enthält er Zeichen wie `,` oder `)`, kann die Filterlogik
  verändert werden (zusätzliche OR-Bedingungen). Dieses Muster existierte
  bereits vor dieser Erweiterung in `getPartnerTradeOrders` (nicht neu
  eingeführt), wurde durch diese Erweiterung aber in eine zweite Funktion
  übernommen.
- **Blast Radius begrenzt:** Der äußere `partner_id`- und
  `revenue_category`-Filter bleiben als separate AND-Bedingungen bestehen —
  ein Angreifer kann also nicht auf fremde Kundendaten zugreifen, nur
  innerhalb der eigenen Kundendaten zusätzliche Zeilen sichtbar machen.
- **Fix-Vorschlag:** Suchbegriff vor dem Einbetten escapen (Kommas/Klammern)
  oder auf `%`/Wildcard-Zeichen beschränken.
- **Priorität:** Sollte behoben werden, ist aber kein Blocker (vorbestehendes
  Muster, begrenzter Blast Radius).
- **Status:** ✅ Behoben (2026-07-17) — neue Helper-Funktion
  `escapeOrFilterValue()` in `orders-helpers.ts` (unit-getestet) escaped
  Backslash/Anführungszeichen, Filterwerte werden jetzt zusätzlich gequotet
  (`ilike."%wert%"`), sodass `,`/`)` im Suchbegriff die Filter-Syntax nicht
  mehr verändern können. In beiden Fundstellen angewendet (auch der
  vorbestehenden in `getPartnerTradeOrders`).

#### BUG-3 (Regressionsrisiko, kein Bug im engeren Sinn): Weniger Zeilen als vorher möglich
- **Severity:** Medium (Business-Impact, kein Code-Fehler)
- **Beschreibung:** Vor dieser Erweiterung wurden ALLE
  `revenue_category = 'trade_goods'`-Positionen angezeigt. Jetzt zusätzlich
  nur die, deren `article_number` einen Treffer in `tms.products` mit
  `type = 'PRODUCT'` hat. Positionen mit fehlendem oder falsch klassifiziertem
  Artikel-Stammdatensatz verschwinden dadurch aus der Bestellhistorie —
  das war eine bewusste Entscheidung (siehe Decision Log), aber die
  tatsächliche Auswirkung auf reale Kundendaten wurde **nicht verifiziert**
  (unbekannt, wie viele `article_number` in der Produktions-DB keinen
  Treffer in `products` haben).
- **Empfehlung:** Vor `/deploy` stichprobenartig bei 2–3 Bestandskunden
  vergleichen: Zeilenzahl vorher vs. nachher, um unerwarteten Datenverlust
  in der Anzeige auszuschließen.
- **Status:** Kein Code-Fix möglich/nötig (bewusste Spec-Entscheidung) —
  bleibt offener Punkt für die Live-Verifikation vor `/deploy`.

### Security-Audit (statisch, Red-Team-Perspektive)
- [x] Auth: Route `/kunden/[id]` durch Middleware geschützt (kein Login →
  Redirect `/login`) — unverändert durch dieses Feature
- [x] Autorisierung: Gleiches Modell wie der Rest der App (jeder
  authentifizierte interne Mitarbeiter sieht jede Kunden-ID) — kein neues
  Datenleck durch diese Erweiterung eingeführt
- [x] XSS: Alle neuen Ausgaben (`group_name`, Zähler) laufen durch normales
  React-Rendering, kein `dangerouslySetInnerHTML` — kein neues Risiko
- [ ] Input-Validierung: siehe BUG-2 (Suchbegriff-Escaping)
- [x] Keine neuen Secrets/Keys im Client-Code sichtbar (Service-Role-Key
  bleibt serverseitig in `orders.ts`, `"use server"`)

### Performance-Hinweis (nicht als Bug gewertet, zur Kenntnis)
`getProductGroupMap()` lädt bei jedem Aufruf ALLE `type='PRODUCT'`-Artikel
(unabhängig vom Kunden) in den Speicher, um die Nummer-zu-Gruppe-Zuordnung zu
bauen. Bei einem sehr großen Artikelkatalog (mehrere Zehntausend Artikel)
könnte das spürbar werden. Aktuell unbekannt, wie groß `tms.products` in
Produktion ist — im `/qa`-Live-Test oder spätestens bei Performance-Monitoring
nach Deploy beobachten.

### Zusammenfassung
- **Akzeptanzkriterien:** 2/7 statisch bestätigt, 5/7 ungeprüft (Live-Daten
  nötig), 0 fehlgeschlagen
- **Bugs gefunden:** 3 (0 Critical, 0 High, 2 Medium, 1 Low) — **2/3 behoben**
  (BUG-1 Truthy-Check, BUG-2 Filter-Escaping); BUG-3 ist eine bewusste
  Spec-Entscheidung ohne Code-Fix, bleibt als Live-Verifikationspunkt offen.
  Nach den Fixes: Typecheck ✅, Build ✅, 8/8 Unit-Tests ✅ (4 neue Tests für
  `escapeOrFilterValue`).
- **Security:** keine kritischen Funde; das Escaping-Muster wurde behoben
- **Production-Ready:** **NOT READY** — nicht wegen gefundener Bugs, sondern
  weil die Kernfunktionalität (Chart-Zahlen, Gruppen-Filter, Leerzustand)
  mangels Datenbankzugriff in dieser Sandbox nicht gegen echte Daten
  verifiziert werden konnte. Empfehlung: einmaligen Live-Test mit einem
  echten Kunden (mehrere Artikelgruppen) vor `/deploy` durchführen, dann
  BUG-1 (einzeilig) beheben, BUG-2 optional vorab oder danach.

---

## Deploy-Verlauf 2026-07-18 (Live-Verifikation + Rollback)

Beim Ausführen des Deploys (`./scripts/deploy.sh PROJ-11`) wurde die von QA
geforderte Live-Verifikation gegen echte Produktionsdaten nachgeholt. Ergebnis:
**die Erweiterung ist in dieser Form nicht produktionsreif** und wurde nach
Rücksprache wieder von Production entfernt.

### Vorgefundener Zustand / Infrastruktur-Erkenntnisse
- **Kein echtes Staging:** `docker-compose.yml` definiert nur einen Service
  `tms` mit Traefik-Router fest auf `tms.gudel-werkzeuge.de` (Production).
  `DEPLOY_TARGET=staging` ändert nur die Verifikations-URL, nicht das Deploy-Ziel
  — ein Deploy landet immer auf Production. **Offener Punkt:** echten
  Staging-Service + Route einführen, bevor „staging" sinnvoll nutzbar ist.
- **Lint-Tooling war projektweit kaputt:** `next lint` existiert in Next 16 nicht
  mehr; ESLint 9 kann die alte `.eslintrc.json` nicht lesen. Migriert auf Flat
  Config (`eslint.config.js`, `eslint-config-next/core-web-vitals`),
  `package.json`-Script auf `eslint .` umgestellt, 8 vorbestehende Lint-Fehler in
  fremden Dateien behoben (Auth-Formulare, Sidebar, Manufacturer-Table,
  discounts-card, page.tsx). *(Diese Änderungen liegen im Feature-Branch,
  wurden NICHT nach Production deployed.)*

### Gefundene Bugs (live, echte Daten)
- **BUG-4 (Critical, Crash):** `orders.ts` (`"use server"`) re-exportierte einen
  Typ via `export type { OrderGroupStat }` aus `orders-helpers.ts`. Turbopack in
  Next 16 leakt das als Laufzeit-Referenz in die Server-Action-Manifest-Datei →
  `ReferenceError: OrderGroupStat is not defined` bei **jedem** Aufruf des
  Bestellhistorie-Tabs (HTTP 500, Tab hängt ewig im Ladezustand). `tsc --noEmit`
  fängt das nicht ab (Bundler-Ebene, kein Typfehler) — deshalb in QA unentdeckt.
  **Fix:** Re-Export entfernt, Typ direkt aus `orders-helpers.ts` importiert
  (Muster wie überall sonst im Code, z.B. `manufacturers.ts`). Lokal verifiziert
  (Lint/tsc/Build/23 Unit-Tests grün). **Liegt im Branch, noch nicht deployed.**
- **BUG-5 (Critical, Design) — ✅ Behoben (2026-07-18, im Branch):**
  `getPartnerTradeOrders` UND `getPartnerOrderGroupStats` luden erst den
  **gesamten** Artikelkatalog (`type='PRODUCT'`) und stopften alle Nummern in
  `.in("article_number", …)`. PostgREST hängt die Liste an die Query-URL → bei
  großem Katalog `URI too long`, beide Abfragen scheiterten. **Fix umgesetzt:**
  Abfrage umgedreht — zuerst die (kunden-begrenzte) Bestellliste holen
  (`fetchCustomerTradeRows`), dann nur deren Artikelnummern gegen den
  Produktstamm mappen (`buildNumberToGroupMap`), Lookups in Blöcken à 150
  (`chunk()`), damit keine `.in()`-URL zu lang wird. Typ-Filter + Pagination
  laufen jetzt in der App-Schicht (korrekter `totalCount` nach Typ-Filter). Neue
  reine Helfer `chunk` + `rowQualifies` in `orders-helpers.ts`, unit-getestet
  (32/32 Tests grün, +9). Behebt zugleich die von QA notierte Speicher-Last
  (kein Voll-Katalog mehr im Speicher). Lint/tsc/Build grün.
  **Noch nicht deployed** — Grund siehe BUG-6.
- **BUG-6 (Blocker für Live-Rendering, VORBESTEHEND — nicht durch die Erweiterung
  verursacht):** Die Bestellhistorie-Query selektiert `invoices.document_number`,
  aber diese Spalte existiert in der Produktions-DB nicht
  (`column invoices_1.document_number does not exist`, 42703) — gilt für die
  Basis auf `main` **und** für den Branch. Solange das nicht geklärt ist, zeigt
  der Tab auch mit BUG-4+BUG-5-Fix keine Daten. DB-Schema-Introspektion war in
  dieser Umgebung gesperrt → **richtiger Spaltenname / fehlende Migration muss
  vom Team bestätigt werden**, bevor die Erweiterung live verifiziert werden kann.

### Rollback (durchgeführt)
- Production am 2026-07-18 auf **`main`** (Commit `37d2640`) zurückgebaut und neu
  deployed. `main` enthält die Erweiterung nicht, dafür alle regulär deployten
  Features (PROJ-20/21/22/28/26).
- **Wichtig:** Das naheliegende „vorherige" Docker-Image (`522bcdfa0a11`,
  2026-07-17 19:23) enthielt die kaputte Erweiterung bereits — ein Rollback
  dorthin hätte nichts gebracht. Production lief also schon **vor** dem heutigen
  Deploy mit dem BUG-4-Crash. Deshalb sauber aus `main` neu gebaut statt Image
  wiederverwendet.
- Verifiziert: `/login` 200, Bestellhistorie-Tab rendert ohne 500 (sauberer
  Leerzustand statt Crash), keine `OrderGroupStat`-/`URI too long`-Fehler mehr.

### Nebenbefunde auf `main` (vorbestehend, NICHT Teil dieser Erweiterung)
- Basis-`getPartnerTradeOrders` wirft `column invoices_1.document_number does not
  exist` (42703) → Bestellhistorie-Basis zeigt Leerzustand statt Daten. Eigenes
  Ticket wert.
- Umsatz-Tab: `Could not find the table 'tms.mv_partner_monthly_revenue' in the
  schema cache` → fehlende Materialized View. Eigenes Ticket wert.

### Auflösung / Deploy erfolgreich (2026-07-18, später am Tag)
Alle Blocker behoben und live verifiziert:
- **BUG-6 vollständig gelöst** — reale DB-Spalten via PostgREST-OpenAPI ermittelt:
  `invoice_number` (statt `document_number`), `single_price_net` /
  `total_price_net` / `cost_price_net` / `discount` (statt der nicht existierenden
  `*_net`/`discount_percent`-Namen). Toter Filter `revenue_category='trade_goods'`
  entfernt (Spalte ist 100% NULL) → „Handelsware" kommt jetzt aus dem
  `products.type='PRODUCT'`-Join (Spec 2.4.1). Preise sind Cent → `centsToEuro()`.
- **BUG-7 (Donut-Query):** gemeinsame Fetch-Funktion sortierte per
  `invoices(document_date)`, das im Stats-Embed fehlte → Donut-Query brach ab.
  Behoben.
- **BUG-8 (instabile Pagination):** Sortierung nach nicht-eindeutigem
  `document_date` verschluckte/duplizierte Zeilen an der 1000er-Seitengrenze
  (Tabelle 129 vs Donut 133). Jetzt Pagination stabil nach eindeutigem `id`,
  Anzeige-Sortierung nach Datum im Speicher → Tabelle und Donut stimmen überein.
- **Live-Verifikation (Playwright, eingeloggt gegen Production, Kunde Bod'or KTM
  GmbH):** Tabelle = 129 Positionen, Donut = 129 (MATCH), 10 Artikelgruppen,
  korrekte Euro-Preise/Rechnungsnummern/Rabatte, Segment-Klick filtert +
  Dropdown-Sync + Toggle funktionieren, keine Server-5xx. Alle Akzeptanzkriterien
  Abschnitt 4 „Bestellhistorie" erfüllt.

### Weiterhin offen
- ~~Umsatz-Tab: fehlende Materialized View `mv_partner_monthly_revenue`~~ →
  **wird durch diesen Refine (2026-07-21) direkt adressiert**, siehe
  Abschnitt 2.3 (Neubau auf `invoice_items`-Basis + neue, getrackte
  `mv_partner_revenue`). Kein separates Ticket mehr nötig.
- ~~`invoice_items.revenue_category` komplett NULL~~ → gelöst durch
  Umstellung auf `products.type` (PRODUCT/SERVICE), siehe Abschnitt 2.3.
- **SEPARATES Ticket, nicht Teil von PROJ-11:** Kein echtes Staging
  (docker-compose deployt immer nach Production).
- **SEPARATES Ticket, nicht Teil von PROJ-11:** Schema-Drift — mehrere
  Tabellen existieren nur in Produktion, nicht in
  `supabase/migrations/` (siehe Open Questions, Abschnitt 10).

---

*Diese Spec folgt dem Workflow aus MEMORY.md: /init → /write-spec → User-Review → /architecture → /frontend → /backend → /qa → /deploy*
