# PROJ-2a.2: Umsatz-Anzeige pro Kunde

**Status:** Spec geschrieben — wartet auf Review/Approval  
**Projekt:** TMS 2.0  
**Priorität:** Hoch (kommt nach PROJ-2a.1)  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-01

---

## 1. Problem-Statement

Keine Übersicht über Umsätze pro Kunde. Der Chef fragt "Wie läuft's bei Müller?" — niemand weiß es genau.

**Werkstatt-Vergleich:** Wie ein Kunde, bei dem du nicht weißt, ob er 10.000 € oder 100.000 € Umsatz im Jahr macht. Schwierig zu priorisieren.

---

## 2. Anforderungen

### Umsatz-Anzeige auf Kunden-Detailseite
**Monatsumsätze, gesplittet in:**
- Handelsumsatz (Verkauf von Handelswaren)
- Service-Umsatz (Reparaturen, Wartung)
- Sonderwerkzeug-Umsatz (Spezialanfertigungen)

### Switch: Umsatz ↔ Rohgewinn
- **Umsatz:** Was der Kunde bezahlt hat
- **Rohgewinn:** Umsatz minus Einkaufspreis (nur Material)
- Switch per Toggle-Button

### Darstellung
- Tabelle: Monat | Handel | Service | Sonderwerkzeug | Gesamt
- Letzte 12 Monate standardmäßig
- Zeitraum auswählbar (z.B. 2026, 2025)
- Optional: Mini-Balkendiagramm

---

## 3. Datenmodell

### Tabelle: `umsaetze`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `kunde_id` | UUID | Referenz zu kunden |
| `jahr` | INTEGER | z.B. 2026 |
| `monat` | INTEGER | 1-12 |
| `handels_umsatz` | DECIMAL(10,2) | Verkaufspreis |
| `handels_einkauf` | DECIMAL(10,2) | Einkaufspreis |
| `service_umsatz` | DECIMAL(10,2) | Verkaufspreis |
| `service_einkauf` | DECIMAL(10,2) | Einkaufspreis |
| `sonderwerkzeug_umsatz` | DECIMAL(10,2) | Verkaufspreis |
| `sonderwerkzeug_einkauf` | DECIMAL(10,2) | Einkaufspreis |
| `created_at` | TIMESTAMP | Eintrag erstellt |

**Berechnung:**
- Rohgewinn Handel = `handels_umsatz` - `handels_einkauf`
- Rohgewinn Service = `service_umsatz` - `service_einkauf`
- Rohgewinn Sonder = `sonderwerkzeug_umsatz` - `sonderwerkzeug_einkauf`

---

## 4. UI/UX

### Auf Kunden-Detailseite (`/kunden/[id]`)
- **Karte "Umsatz"** (neben Stammdaten)
- Toggle: Umsatz | Rohgewinn
- Tabelle mit Monatswerten
- Summe aktuelles Jahr
- Zeitraum-Auswahl (Dropdown)

---

## 5. Akzeptanzkriterien

- [ ] Umsatz-Tabelle zeigt Monatswerte korrekt
- [ ] Switch Umsatz ↔ Rohgewinn funktioniert sofort
- [ ] Werte sind korrekt berechnet (Rohgewinn = Umsatz - Einkauf)
- [ ] Zeitraum ist auswählbar
- [ ] Summen werden korrekt angezeigt
- [ ] Responsive: Desktop + Tablet

---

## 6. Technische Details

### Neue Dateien:
- `src/components/kunden/umsatz-anzeige.tsx`
- `src/lib/actions/umsaetze.ts`
- `supabase/migrations/0004_umsaetze.sql`

### RLS:
- Alle Nutzer können Umsätze **lesen**
- Nur Admin/Buchhaltung darf Umsätze **schreiben**

---

## 7. Abhängigkeiten

- ✅ PROJ-1 (Auth) — erledigt
- ❌ PROJ-2a.1 (Kunden-Stammdaten) — Muss zuerst fertig sein

---

## 8. Zeitschätzung

- Datenbank: 30 Min
- Backend: 1.5 Stunden
- Frontend: 2.5 Stunden
- Tests: 1 Stunde
- **Gesamt:** ~0.75 Tage

---

*Diese Spec folgt dem Workflow aus MEMORY.md*
