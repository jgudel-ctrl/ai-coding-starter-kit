# PROJ-2a.1: Kunden-Stammdaten (CRUD)

**Status:** Approved ✅ → Architektur approved → Frontend & Backend gebaut → Jetzt: /qa → /deploy  
**Projekt:** TMS 2.0  
**Priorität:** Hoch  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-01

---

## 1. Problem-Statement

Keine zentrale Kunden-Verwaltung. Kunden-Infos sind verteilt oder nur im Kopf.

**Werkstatt-Vergleich:** Wie eine Werkstatt ohne Karteikarten — niemand weiß, wo Müller GmbH liegt oder wer dort der Ansprechpartner ist.

---

## 2. Anforderungen

### Kunden anlegen
- Firmenname, Ansprechpartner Name
- Telefon, E-Mail
- Rechnungsadresse (Straße, PLZ, Ort)
- Lieferadresse (falls anders)
- Notizen

### Kunden bearbeiten
- Alle Felder nachträglich ändern
- Historie: Wer hat wann was geändert?

### Kunden suchen
- Schnellsuche nach Firmenname oder Ansprechpartner
- Liste mit allen Kunden
- Inaktive Kunden ausgeblendet (nur Admin sieht sie)

### Kunden "löschen"
- Soft-delete: Als "inaktiv" markieren
- Nicht physisch löschen (historische Aufträge bleiben erhalten)

---

## 3. Datenmodell

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

### Tabelle: `kunden_history`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `kunde_id` | UUID | Referenz |
| `feld` | TEXT | Welches Feld? |
| `alter_wert` | TEXT | Vorher |
| `neuer_wert` | TEXT | Nachher |
| `geaendert_von` | UUID | Wer? |
| `geaendert_am` | TIMESTAMP | Wann? |

---

## 4. UI/UX

### Kunden-Liste (`/kunden`)
- Tabelle: Firmenname | Ansprechpartner | Telefon | Ort | Status | Aktionen
- Suchleiste + "Neuen Kunden anlegen"-Button
- Filter: Nur aktive / Alle
- Klick auf Zeile → Detail-Ansicht

### Kunden-Detail-Ansicht (`/kunden/[id]`)
- **Karte 1 — Stammdaten:**
  - Firmenname, Ansprechpartner
  - Telefon (anklickbar), E-Mail (anklickbar)
  - Rechnungsadresse, Lieferadresse
  - Notizen
  - Button: "Bearbeiten"

### Kunden bearbeiten (`/kunden/[id]/bearbeiten`)
- Formular mit allen Feldern
- Validierung: Firmenname Pflichtfeld
- Buttons: Speichern, Abbrechen, Als inaktiv markieren (nur Admin)

---

## 5. Akzeptanzkriterien

- [ ] Admin kann neuen Kunden anlegen
- [ ] Admin kann Kunden bearbeiten (alle Felder)
- [ ] Jeder Nutzer kann Kunden suchen und filtern
- [ ] Detail-Ansicht zeigt alle Stammdaten übersichtlich
- [ ] Telefon/E-Mail sind anklickbar (tel:/mailto:)
- [ ] Soft-delete funktioniert (als "inaktiv" markieren)
- [ ] Historie zeigt Änderungen mit Wer/Wann
- [ ] Responsive: Desktop + Tablet
- [ ] Keine Console-Fehler

---

## 6. Technische Details

### Neue Dateien:
- `src/app/kunden/page.tsx` — Liste
- `src/app/kunden/[id]/page.tsx` — Detail
- `src/app/kunden/[id]/bearbeiten/page.tsx` — Bearbeiten
- `src/components/kunden/kunden-table.tsx`
- `src/components/kunden/kunden-form.tsx`
- `src/components/kunden/kunden-detail-card.tsx`
- `src/lib/actions/kunden.ts`
- `src/lib/validations/kunde.ts`
- `supabase/migrations/0003_kunden.sql`

### RLS:
- Alle Nutzer können Kunden **lesen**
- Nur Admin/AV können Kunden **anlegen/bearbeiten**
- Nur Admin können Kunden als **inaktiv** markieren

---

## 7. Zeitschätzung

- Spec: 30 Min (gemacht)
- Datenbank: 30 Min
- Backend: 2 Stunden
- Frontend: 3 Stunden
- Tests: 1 Stunde
- **Gesamt:** ~1 Tag

---

*Diese Spec folgt dem Workflow aus MEMORY.md: /init → /write-spec → User-Review → /architecture → /frontend → /backend → /qa → /deploy*
