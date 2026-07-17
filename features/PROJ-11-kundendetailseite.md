# PROJ-11: Kundendetailseite (erweitert)

**Status:** Deployed — Erweiterung (Bestellhistorie Produkttyp/Gruppierung/Donut-Chart) in Review, wartet auf Approval  
**Projekt:** TMS 2.0  
**Priorität:** Hoch  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-02 (Erweiterung: 2026-07-17)

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

## 9. Decision Log

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

*Diese Spec folgt dem Workflow aus MEMORY.md: /init → /write-spec → User-Review → /architecture → /frontend → /backend → /qa → /deploy*
