# PROJ-22 — Kalender für blockierte Tage: Architektur

**Status:** In Review  
**Erstellt:** 2026-07-06  

---

## Zusammenfassung

Neue Admin-Seite `/verwaltung/abholungskalender` mit einem **visuellen Kalender** (Monats-/Wochen-/Jahresansicht), der alle blockierten Tage aus `tms.blocked_days` farblich anzeigt. Interaktion: Klick auf Tag → Details oder Neuer Blocker. Keine DB-Änderungen nötig.

---

## Datenquelle (existiert bereits)

| Tabelle | `tms.blocked_days` |
|---------|-------------------|
| Spalten | `id, von_datum, bis_datum, grund, typ, erstellt_am, erstellt_von` |
| Typen | `feiertag` (auto), `manuell` (Admin) |
| RLS | SELECT für alle eingeloggten Nutzer; ALL nur für Admin |

### Actions (existieren bereits)
- `getBlockedPeriods()` → lädt alle Blocker
- `initializeHolidays()` → berechnet NRW-Feiertage (idempotent)
- `addBlockedPeriod(von, bis, grund)` → neuer manueller Blocker
- `removeBlockedPeriod(id)` → löscht Blocker

---

## Neue Dateien

### 1. Seite: `src/app/(app)/verwaltung/abholungskalender/page.tsx`
- **Server-Komponente**
- Prüft Admin-Rechte (`notFound()` wenn kein Admin)
- Ruft `initializeHolidays()` und `getBlockedPeriods()` auf
- Übergibt Daten an Client-Komponente

### 2. Client-Komponente: `src/app/(app)/verwaltung/abholungskalender/components/pickup-calendar.tsx`
- **"use client"**
- State: `ansicht` ("monat" | "woche" | "jahr"), `aktuellerMonat`, `aktuellerTag`
- Render-Logik je nach Ansicht

### 3. Monats-Kalender-Grid: `src/components/calendar/month-view.tsx`
- CSS Grid: 7 Spalten × variable Zeilen
- Header: Mo–So
- Tage werden gerendert mit:
  - Normale Tage → weißer Hintergrund
  - Heute → blauer Rahmen
  - Blockierte Tage → farbiger Hintergrund + Tooltip/Label
- Klick auf Tag → öffnet Detail-Modal

### 4. Wochen-Ansicht: `src/components/calendar/week-view.tsx`
- 7 Spalten (Mo–So), 1 Zeile pro Tag
- Jeder Tag als vertikale Karte mit:
  - Datum
  - Blocker-Liste (falls vorhanden)
  - Button "Blockieren" falls frei

### 5. Jahres-Ansicht: `src/components/calendar/year-view.tsx`
- 12 Mini-Monatskalender in einem Grid (3×4 oder 4×3)
- Nur kleine Tage-Kästchen, Blocker als Farb-Pünktchen
- Klick auf Mini-Monat → springt zur Monatsansicht

### 6. Detail-Modal: `src/components/calendar/day-detail-modal.tsx`
- shadcn `Dialog`
- Zeigt Blocker für den Tag mit Grund, Zeitraum, Typ
- Button „Löschen" (nur manuelle Blocker)
- Button „Blocker hinzufügen" (falls keiner da ist)

### 7. Neuer Blocker Modal: `src/components/calendar/add-blocker-modal.tsx`
- shadcn `Dialog`
- Formular: Von-Datum, Bis-Datum, Grund (Text)
- Speichern → ruft Server Action `addBlockedPeriod()`
- Erfolg → Modal schließen, Seite revalidaten

### 8. Navigation-Update: Globaler Header
- Unter „Verwaltung" → neuer Link „Abholungskalender"
- Link zur Route `/verwaltung/abholungskalender`

---

## Tech-Entscheidungen

| Entscheidung | Begründung |
|--------------|-----------|
| **Keine Library** (`react-big-calendar` etc.) | Nicht installiert, Custom-Lösung mit CSS Grid ist für einfachen Monatskalender ausreichend und hat weniger Overhead |
| **CSS Grid statt Flexbox** | Monatskalender = tabellarisch, Grid ist natürlicher |
| **Revalidierung statt Optimistic UI** | Einfacher, Actions sind schon vorhanden |
| **Native HTML-Inputs** (`<input type="date">`) | shadcn DatePicker nicht installiert; Radix Portal-Probleme bei PROJ-17 |

---

## Farben & Design

| Zustand | Farbe | Bedeutung |
|---------|-------|-----------|
| Feiertag | `bg-blue-100` / `text-blue-700` | Automatisch, nicht löschbar |
| Manueller Blocker | `bg-orange-100` / `text-orange-700` | Admin-Eintrag (Urlaub etc.) |
| Beides | Halb/halb oder überlappend | Sehr selten |
| Heute | `ring-2 ring-primary` | Aktueller Tag |
| Wochenende | `bg-muted/30` | Sa/So leicht abgedunkelt |

---

## Mobile-Ansicht

- Monatsansicht: Tage kleiner, Text kürzer (z.B. nur „F" statt „Feiertag")
- Wochenansicht: Horizontales Scrollen oder Stapeln
- Jahresansicht: 2×6 Grid statt 3×4

---

## Keine DB-Änderungen

Die Tabelle `tms.blocked_days` existiert bereits mit allen benötigten Spalten und RLS-Policies.

---

## Abhängigkeiten

- `tms.blocked_days` (PROJ-20) ✅
- `blocked-days.ts` Actions (PROJ-20) ✅
- `pickup-utils.ts` Feiertagsberechnung (PROJ-20) ✅
- shadcn/ui: `Dialog`, `Button`, `Tabs` ✅

---

## Risiken & Abschwächungen

| Risiko | Abschwächung |
|--------|-------------|
| Performance bei vielen Blockern | Nur 2 Jahre Feiertage + manuelle Einträge, max. ~50 Datensätze |
| Mobile Monatsansicht zu klein | Tage werden klein aber klickbar, Tooltip/Modal für Details |
| Jahresansicht überladen | Mini-Monate nur mit Farb-Pünktchen, kein Text |
