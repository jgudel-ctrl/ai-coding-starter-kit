# PROJ-22 — Kalender für blockierte Tage (Admin)

**Status:** In Progress  
**Erstellt:** 2026-07-06  
**Ziel-Release:** --

---

## Ziel

Neue Admin-Seite mit einem **visuellen Kalender**, auf dem alle Tage markiert sind, an denen keine Abholungen stattfinden (Feiertage + manuelle Blocker wie Urlaub/Betriebsferien).

**Nutzer-Auswirkung:** Der Admin sieht auf einen Blick — Monat für Monat, Woche für Woche, Jahr für Jahr — welche Tage blockiert sind. Kein Durchklicken durch Listen mehr.

---

## Anforderungen

### 1. Neue Seite: `/verwaltung/abholungskalender`
- Eigene Route im Admin-Bereich
- Link im globalen Header unter „Verwaltung"

### 2. Kalender-Ansichten
- **Monatsansicht** (Standard): Wandkalender-Look, 7 Spalten (Mo–So)
- **Wochenansicht**: Zeigt eine Woche im Detail
- **Jahresansicht**: 12 Mini-Monatskalender auf einer Seite
- Navigation: Vor/Zurück, „Heute"-Button

### 3. Farbliche Markierung
- 🔵 **Feiertage** (automatisch, blau)
- 🟠 **Manuelle Blocker** (orange: Urlaub, Betriebsferien, etc.)
- Beides an einem Tag = beide Farben sichtbar
- **Heute** wird mit einem Rahmen hervorgehoben

### 4. Interaktion
- **Klick auf einen blockierten Tag**: Popup mit Details (Grund, Zeitraum, Typ)
- **Klick auf einen freien Tag**: „Neuer Blocker"-Popup mit Von–Bis + Grund
- **Löschen** direkt aus dem Popup heraus

### 5. Feiertage
- **Automatisch** für aktuelles + nächstes Jahr berechnet (NRW)
- Werden beim ersten Seitenaufruf initialisiert (idempotent)
- Admin kann einzelne Feiertage löschen (falls nötig)

---

## Nicht im Scope

- Drag & Drop zum Verschieben (reicht PROJ-20)
- Wiederkehrende Blocker (z.B. „jeden ersten Freitag")
- Export als PDF/iCal

---

## Akzeptanzkriterien

- [ ] Seite `/verwaltung/abholungskalender` erreichbar (nur Admin)
- [ ] Monats-/Wochen-/Jahresansicht funktionieren
- [ ] Feiertage sind automatisch markiert
- [ ] Manuelle Blocker können hinzugefügt und gelöscht werden
- [ ] Heute wird markiert
- [ ] Mobile-Ansicht ist nutzbar (mindestens Monatsansicht)
