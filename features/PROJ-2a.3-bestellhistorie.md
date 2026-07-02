# PROJ-2a.3: Bestellhistorie Handelswaren

**Status:** Spec geschrieben — wartet auf Review/Approval  
**Projekt:** TMS 2.0  
**Priorität:** Mittel (kommt nach PROJ-2a.2)  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-01

---

## 1. Problem-Statement

Keine Übersicht über vergangene Bestellungen pro Kunde. Wenn ein Kunde anruft und fragt "Haben wir letzten Monat nicht 20x Schraube M8 bestellt?" — niemand weiß es.

**Werkstatt-Vergleich:** Wie ein Lager, bei dem du nicht weißt, was wann an wen geliefert wurde. Schwierig bei Nachfragen oder Reklamationen.

---

## 2. Anforderungen

### Bestellhistorie auf Kunden-Detailseite
- Alle vergangenen Bestellungen pro Kunde
- Spalten: Datum | Artikel | Artikelnummer | Menge | Preis/Einheit | Gesamt
- Neueste Bestellungen zuerst
- Filter nach Zeitraum (z.B. letzte 3 Monate, letztes Jahr)
- Paginierung: 10 Bestellungen pro Seite

### Zusatz-Info
- Kategorie der Bestellung: Handelsware, Service, Sonderwerkzeug
- Notizen pro Bestellung (optional)

---

## 3. Datenmodell

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

---

## 4. UI/UX

### Auf Kunden-Detailseite (`/kunden/[id]`)
- **Karte "Bestellhistorie"** (unten, breit)
- Tabelle mit letzten 10 Bestellungen
- Button: "Alle Bestellungen anzeigen" → eigene Seite
- Filter: Zeitraum (Dropdown)

### Alle Bestellungen (`/kunden/[id]/bestellungen`)
- Vollständige Tabelle mit Paginierung
- Filter: Zeitraum, Kategorie
- Sortierung: Datum (neueste zuerst)

---

## 5. Akzeptanzkriterien

- [ ] Bestellhistorie zeigt alle Bestellungen chronologisch
- [ ] Filter nach Zeitraum funktioniert
- [ ] Paginierung funktioniert
- [ ] Gesamtpreis ist korrekt berechnet
- [ ] Responsive: Desktop + Tablet

---

## 6. Technische Details

### Neue Dateien:
- `src/components/kunden/bestell-historie.tsx`
- `src/app/kunden/[id]/bestellungen/page.tsx`
- `src/lib/actions/bestellungen.ts`
- `supabase/migrations/0005_bestellungen.sql`

### RLS:
- Alle Nutzer können Bestellungen **lesen**
- Nur Admin darf Bestellungen **schreiben**

---

## 7. Abhängigkeiten

- ✅ PROJ-1 (Auth) — erledigt
- ❌ PROJ-2a.1 (Kunden-Stammdaten) — Muss zuerst fertig sein
- ❌ PROJ-2a.2 (Umsatz) — Kann parallel kommen

---

## 8. Zeitschätzung

- Datenbank: 30 Min
- Backend: 1 Stunde
- Frontend: 2 Stunden
- Tests: 1 Stunde
- **Gesamt:** ~0.5 Tage

---

## 9. Daten-Einpflege (Wichtig!)

Die Tabelle `bestellungen` ist am Anfang leer. Daten müssen eingetragen werden:

**Option A:** CSV-Import aus bestehendem System
**Option B:** Manuell über Admin-Interface
**Option C:** API-Anbindung an ERP (zukünftig)

Jan Bernd entscheidet, wie historische Daten hereinkommen.

---

*Diese Spec folgt dem Workflow aus MEMORY.md*
