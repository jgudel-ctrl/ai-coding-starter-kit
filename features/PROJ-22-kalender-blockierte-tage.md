# PROJ-22 — Kalender für blockierte Tage (Admin)

**Status:** ✅ Deployed — Change Request 2026-07-07
**Erstellt:** 2026-07-06
**Ziel-Release:** --

---

## Ziel

**Neue Admin-Seite** `/verwaltung/abholungskalender` mit visuellem Kalender. Alle Blocker-Verwaltung (Feiertage + manuelle Blocker) findet auf dieser einen Seite statt.

**Nutzer-Auswirkung:** Der Admin sieht auf einen Blick — Monat für Monat, Woche für Woche, Jahr für Jahr — welche Tage blockiert sind (Feiertage, Wochenende, manuelle Blocker). Kein Durchklicken durch Listen mehr.

---

## Change Request 2026-07-07

### Vorher:
- Zwei separate Seiten: `/verwaltung/blocker` + `/verwaltung/abholungskalender`
- Blocker-Verwaltung war eine Tabelle mit Formular
- Feiertage erst bei Seitenaufruf initialisiert
- Keine automatische Feiertags-Aktualisierung

### Neu:
- **Eine Seite:** `/verwaltung/abholungskalender`
- Blocker-Verwaltung ist **in den Kalender integriert**
- **Wochenende (Sa/So)** wird als blockiert markiert
- **Cron-Job** aktualisiert Feiertage monatlich automatisch

---

## Anforderungen

### 1. Seite: `/verwaltung/abholungskalender`
- Eigene Route im Admin-Bereich (nur Admin)
- Link im globalen Header unter „Verwaltung"

### 2. Kalender-Ansichten
- **Monatsansicht** (Standard): Wandkalender-Look, 7 Spalten (Mo–So)
- **Wochenansicht**: Zeigt eine Woche im Detail
- **Jahresansicht**: 12 Mini-Monatskalender auf einer Seite
- Navigation: Vor/Zurück, „Heute"-Button

### 3. Blockierte Tage — Farbliche Markierung
- 🔵 **Feiertage** (automatisch, blau)
- 🟠 **Manuelle Blocker** (orange: Urlaub, Betriebsferien, etc.)
- 🔘 **Wochenende** (Samstag + Sonntag, grau — visuell markiert als „Wochenende")
- Beides an einem Tag = beide Farben sichtbar
- **Heute** wird mit einem Rahmen hervorgehoben

### 4. Interaktion (alles im Kalender)
- **Klick auf blockierten Tag** (Feiertag/manuell): Popup mit Details + Löschen (nur manuelle)
- **Klick auf Wochenende**: Kein Popup (oder Info „Wochenende — nicht blockierbar")
- **Klick auf freien Tag** (Mo–Fr, nicht blockiert): „Neuer Blocker"-Popup
- **Löschen** direkt aus dem Popup

### 5. Feiertage — Automatisch
- **Cron-Job** läuft monatlich (z.B. 1. jeden Monats)
- Erstellt/aktualisiert Feiertage für die nächsten **12 Monate**
- NRW-Feiertage (Neujahr, Karfreitag, Ostermontag, Tag der Arbeit, Christi Himmelfahrt, Pfingstmontag, Fronleichnam, Tag der Deutschen Einheit, Allerheiligen, Weihnachten)
- Berechnung über Gauß-Oster-Algorithmus
- Idempotent: Bereits vorhandene Feiertage werden übersprungen

### 6. Wochenende — Automatisch
- Samstag und Sonntag werden im Kalender als „Wochenende" markiert
- Keine DB-Einträge nötig (rein visuell im Client)
- Keine manuelle Blockierung von Wochenenden möglich

---

## Nicht im Scope

- Drag & Drop zum Verschieben
- Wiederkehrende Blocker
- Export als PDF/iCal

---

## Akzeptanzkriterien

- [ ] Seite `/verwaltung/abholungskalender` erreichbar (nur Admin)
- [ ] Monats-/Wochen-/Jahresansicht funktionieren
- [ ] Feiertage sind automatisch markiert (via Cron-Job)
- [ ] Samstag/Sonntag sind als „Wochenende" markiert
- [ ] Manuelle Blocker können im Kalender-Popup hinzugefügt/gelöscht werden
- [ ] Heute wird markiert
- [ ] Mobile-Ansicht ist nutzbar
- [ ] Cron-Job läuft monatlich und aktualisiert Feiertage für +12 Monate

---

## Technische Details

### Datenbank (tms.blocked_days)
| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid | PK, auto-generiert |
| von_datum | date | Startdatum |
| bis_datum | date | Enddatum |
| grund | text | Name des Feiertags / Grund |
| typ | text | `feiertag` oder `manuell` |
| erstellt_am | timestamptz | Automatisch |
| erstellt_von | uuid | FK auf auth.users |

### Cron-Job (isolierte Session)
- **Schedule:** Monatlich, 1. jeden Monats um 03:00 Uhr
- **Action:** `initializeHolidays` mit erweitertem Zeitraum (aktuelles Jahr + nächstes Jahr)
- **Session Target:** isolated (background task)
- **Delivery:** Keine — läuft silent im Hintergrund

