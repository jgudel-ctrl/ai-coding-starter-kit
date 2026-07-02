# PROJ-2a: Kunden-Verwaltung mit Umsatz & Bestellhistorie

**Status:** Spec geschrieben — wartet auf Review/Approval  
**Projekt:** TMS 2.0  
**Priorität:** Hoch  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-01

---

## 1. Problem-Statement

**Was fehlt:** Keine zentrale Kunden-Verwaltung. Keine Übersicht über Umsätze, Rohgewinne oder Bestellhistorien pro Kunde. Kunden-Infos sind verteilt oder nur im Kopf der Mitarbeiter.

**Werkstatt-Vergleich:** Stell dir vor, du hast 50 Stammkunden, aber keine Karteikarten. Du weißt nicht, wer wie viel Umsatz macht, wer regelmäßig bestellt, und wer die Profitabelsten sind. Jedes Mal wenn der Chef fragt "Wie läuft's bei Müller GmbH?", musst du im Excel oder in der Buchhaltung nachschauen.

**Warum wichtig:** Der Kunde ist der Ausgangspunkt für alle Aufträge. Ohne Kunden-Übersicht keine Planung, keine Priorisierung, keine strategischen Entscheidungen.

---

## 2. Anforderungen

### 2.1 Kunden-Stammdaten (CRUD)
- Firmenname, Ansprechpartner
- Telefon, E-Mail (anklickbar)
- Rechnungsadresse + Lieferadresse
- Notizen / Besonderheiten
- Soft-delete (als "inaktiv" markieren)

### 2.2 Umsatz-Anzeige (DAS Wichtigste!)
**Monatsumsätze pro Kunde, gesplittet in:**
- Handelsumsatz (Verkauf von Handelswaren)
- Service-Umsatz (Reparaturen, Wartung, Service-Leistungen)
- Sonderwerkzeug-Umsatz (Spezialanfertigungen, Custom-Tools)

**Switch:** Umsatz ↔ Rohgewinn
- **Umsatz = Verkaufspreis** (was der Kunde bezahlt)
- **Rohgewinn = Umsatz - Einkaufspreis** (was bleibt nach Material-Kosten)
- **Wichtig:** Rohgewinn = NUR Material abgezogen, keine Lohnkosten, keine Fixkosten

**Darstellung:**
- Tabelle: Monat | Handel | Service | Sonderwerkzeug | Gesamt
- Optional: Diagramm (Balken oder Linie)
- Zeitraum: Letzte 12 Monate (oder auswählbar)

### 2.3 Bestellhistorie Handelswaren
- Alle vergangenen Bestellungen pro Kunde
- Spalten: Datum | Artikel | Menge | Preis | Gesamt
- Filter nach Zeitraum
- Sortierung nach Datum (neueste zuerst)

### 2.4 Kunden-Detail-Ansicht (Alles auf einen Blick)
**Layout: Kartenbasiert (Bento-Style)**

**Karte 1 — Stammdaten (oben links):**
- Firmenname
- Ansprechpartner, Telefon, E-Mail
- Rechnungsadresse
- Lieferadresse (falls anders)
- Notizen
- Button: "Bearbeiten"

**Karte 2 — Umsatz-Übersicht (oben rechts, groß):**
- Switch: Umsatz ↔ Rohgewinn
- Tabelle mit Monatswerten
- Gesamtsumme aktuelles Jahr
- Optional: Mini-Diagramm

**Karte 3 — Bestellhistorie (unten, breit):**
- Tabelle mit letzten 10 Bestellungen
- Button: "Alle Bestellungen anzeigen"

---

## 3. Datenmodell (NEUE Tabellen)

### Tabelle: `kunden`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `firmenname` | TEXT | Name der Firma |
| `ansprechpartner_name` | TEXT | Name |
| `ansprechpartner_telefon` | TEXT | Telefon |
| `ansprechpartner_email` | TEXT | E-Mail |
| `rechnungsadresse_strasse` | TEXT | Straße + Hausnummer |
| `rechnungsadresse_plz` | TEXT | PLZ |
| `rechnungsadresse_ort` | TEXT | Ort |
| `lieferadresse_strasse` | TEXT | Optional |
| `lieferadresse_plz` | TEXT | Optional |
| `lieferadresse_ort` | TEXT | Optional |
| `notizen` | TEXT | Besonderheiten |
| `status` | ENUM | `aktiv`, `inaktiv` |
| `created_at` | TIMESTAMP | Angelegt |
| `updated_at` | TIMESTAMP | Geändert |
| `created_by` | UUID | Wer hat angelegt |
| `updated_by` | UUID | Wer hat geändert |

### Tabelle: `umsaetze`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `kunde_id` | UUID | Referenz zu kunden |
| `jahr` | INTEGER | z.B. 2026 |
| `monat` | INTEGER | 1-12 |
| `handels_umsatz` | DECIMAL(10,2) | Verkaufspreis Handel |
| `handels_einkauf` | DECIMAL(10,2) | Einkaufspreis Handel |
| `service_umsatz` | DECIMAL(10,2) | Verkaufspreis Service |
| `service_einkauf` | DECIMAL(10,2) | Einkaufspreis Service |
| `sonderwerkzeug_umsatz` | DECIMAL(10,2) | Verkaufspreis Sonder |
| `sonderwerkzeug_einkauf` | DECIMAL(10,2) | Einkaufspreis Sonder |
| `created_at` | TIMESTAMP | Eintrag erstellt |

**Berechnung Rohgewinn:**
- Handels-Rohgewinn = `handels_umsatz` - `handels_einkauf`
- Service-Rohgewinn = `service_umsatz` - `service_einkauf`
- Sonder-Rohgewinn = `sonderwerkzeug_umsatz` - `sonderwerkzeug_einkauf`

### Tabelle: `bestellungen`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `kunde_id` | UUID | Referenz zu kunden |
| `bestelldatum` | DATE | Wann bestellt? |
| `artikel_name` | TEXT | Was wurde bestellt? |
| `artikel_nummer` | TEXT | Artikelnummer |
| `menge` | INTEGER | Wie viel? |
| `preis_pro_einheit` | DECIMAL(10,2) | Stückpreis |
| `gesamtpreis` | DECIMAL(10,2) | Berechnet: menge × preis |
| `kategorie` | ENUM | `handel`, `service`, `sonderwerkzeug` |
| `notizen` | TEXT | Optional |
| `created_at` | TIMESTAMP | Eintrag erstellt |

### Tabelle: `kunden_history`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `kunde_id` | UUID | Referenz zu kunden |
| `feld` | TEXT | Welches Feld wurde geändert? |
| `alter_wert` | TEXT | Vorher |
| `neuer_wert` | TEXT | Nachher |
| `geaendert_von` | UUID | Wer hat geändert? |
| `geaendert_am` | TIMESTAMP | Wann? |

---

## 4. UI/UX

### 4.1 Kunden-Liste (`/kunden`)
- Tabelle: Firmenname | Ansprechpartner | Ort | Status
- Suchleiste oben
- Filter: Nur aktive / Alle
- Klick auf Zeile → Detail-Ansicht

### 4.2 Kunden-Detail-Ansicht (`/kunden/[id]`)
**3 Karten (Bento-Layout):**

**Karte 1 — Stammdaten:**
- Alle Adressdaten, Telefon, E-Mail
- Notizen
- Button "Bearbeiten"

**Karte 2 — Umsatz (groß):**
- Switch: Umsatz ↔ Rohgewinn
- Tabelle: Monat | Handel | Service | Sonderwerkzeug | Gesamt
- Summe aktuelles Jahr
- Optional: Mini-Balkendiagramm

**Karte 3 — Bestellhistorie:**
- Tabelle: Datum | Artikel | Menge | Preis | Gesamt
- "Alle anzeigen"-Button

### 4.3 Kunden bearbeiten (`/kunden/[id]/bearbeiten`)
- Formular mit allen Feldern
- Validierung: Firmenname Pflichtfeld
- Buttons: Speichern, Abbrechen

---

## 5. Akzeptanzkriterien

- [ ] Kunden CRUD funktioniert (anlegen, bearbeiten, löschen/soft-delete)
- [ ] Adressen werden korrekt angezeigt und gespeichert
- [ ] Umsatz-Tabelle zeigt Monatswerte korrekt an
- [ ] Switch Umsatz ↔ Rohgewinn funktioniert sofort
- [ ] Bestellhistorie zeigt alle Bestellungen chronologisch
- [ ] Kunden-Liste sucht und filtert in unter 1 Sekunde
- [ ] Telefon/E-Mail sind anklickbar (tel:/mailto:)
- [ ] Responsive: Funktioniert auf Desktop und Tablet
- [ ] Keine Console-Fehler

---

## 6. Technische Details

### Neue Dateien:
- `src/app/kunden/page.tsx` — Liste
- `src/app/kunden/[id]/page.tsx` — Detail-Ansicht
- `src/app/kunden/[id]/bearbeiten/page.tsx` — Bearbeiten
- `src/components/kunden/kunden-table.tsx` — Tabelle
- `src/components/kunden/kunden-form.tsx` — Formular
- `src/components/kunden/umsatz-anzeige.tsx` — Umsatz-Komponente
- `src/components/kunden/bestell-historie.tsx` — Bestellhistorie
- `src/lib/actions/kunden.ts` — CRUD Actions
- `src/lib/actions/umsaetze.ts` — Umsatz-Actions
- `src/lib/actions/bestellungen.ts` — Bestell-Actions
- `supabase/migrations/0003_kunden_umsatz_bestellungen.sql`

### RLS:
- Alle Nutzer können Kunden **lesen**
- Nur Admin/AV können Kunden **anlegen/bearbeiten**
- Umsatz/Bestellungen: Nur Admin/Verwaltung darf **schreiben**
- Alle dürfen Umsatz/Bestellungen **lesen**

---

## 7. Daten-Einpflege (Wichtig!)

Die Tabellen `umsaetze` und `bestellungen` sind am Anfang leer. Die Daten müssen eingetragen werden:

**Option A (empfohlen):** CSV-Import aus bestehendem System/Excel
**Option B:** Manuell über ein Admin-Interface
**Option C:** API-Anbindung an ERP (zukünftig)

Jan Bernd entscheidet, wie die historischen Daten hereinkommen.

---

## 8. Zeitschätzung

- Spec: 30 Min (gemacht)
- Datenbank-Migration: 1 Stunde
- Backend (Actions): 3 Stunden
- Frontend (Liste + Formular): 3 Stunden
- Frontend (Detail + Umsatz + Bestellungen): 4 Stunden
- Tests: 2 Stunden
- **Gesamt:** ~2-3 Tage

---

## 9. Nächste Schritte

1. **Diese Spec reviewen** — Jan Bernd prüft und gibt "approved"
2. **/architecture** — Technische Details + Datenbank-Schema finalisieren
3. **/frontend + /backend** — Parallel bauen
4. **/qa** — Tests
5. **/deploy** — Auf Server deployen

---

*Diese Spec folgt dem Workflow aus MEMORY.md: /init → /write-spec → User-Review → /architecture → /frontend → /backend → /qa → /deploy*
