# PROJ-15: Umsatz-Vergleich mit Vorjahr — KPIs, Prozente, Linien & Jahres-Switch

- **Bugfix (2026-07-02 22:35):** Chart-Farben waren nicht konsistent mit KPI-Karten. Handelsware war blau statt grün, Service war grün statt orange. Fix: Farben im AreaChart an KPI-Farben angeglichen.
- **Änderung (2026-07-02 22:50):** YTD ersetzt durch Rolling 12 Months. Zeigt jetzt die letzten 12 vollständigen Monate (z.B. Aug 25 – Jul 26) statt "Jan bis jetzt". Vergleich zeigt die 12 Monate davor.

## Status: Deployed ✅ (2026-07-02)
## Author: Klausi
## Date: 2026-07-02

---

## Zusammenfassung (1 Satz)

Die Umsatz-Ansicht auf der Kundendetailseite bekommt einen Vorjahresvergleich mit prozentualen Änderungen, ausgefüllte Linien statt Balken, und einen Schalter zwischen Monats- und Jahres-Ansicht.

---

## Motivation

Jan Bernd möchte schnell erkennen, ob der Kunde dieses Jahr mehr oder weniger umsetzt als im Vorjahr. Bisher ändern sich die KPI-Karten nicht, wenn man das Jahr wechselt — sie zeigen immer nur das aktuelle Jahr. Außerdem sollen Balken durch übersichtlichere Linien ersetzt werden, und es soll eine Jahres-Übersicht geben, die den Langzeit-Trend zeigt.

---

## Was wird geändert

### 1. KPI-Karten (RevenueSummary) — Jahr-abhängig + Vorjahresvergleich

**Bisher:** Die Karten zeigen immer das aktuelle Jahr (2026), egal welches Jahr im Dropdown gewählt ist.

**Neu:**
- Karten zeigen das **ausgewählte Jahr**
- Hinter jedem Betrag steht in kleiner Schrift die **Änderung zum Vorjahr in Prozent** (z.B. "+12% vs. 2025" oder "-8% vs. 2025")
- Farbcodierung: Grün bei Plus, Rot bei Minus, Grau bei gleich/keine Daten
- Bei fehlenden Vorjahresdaten: Kein Vergleichs-Text

**Technisch:** RevenueSummary bekommt zwei neue Props: `selectedYear` und `previousYearData`.

### 2. Chart-Modus-Schalter: Monatsansicht ↔ Jahresansicht

**Neuer Toggle/Schalter** über dem Chart:
- **Monatsansicht** (Standard): Zeigt 12 Monate des ausgewählten Jahres
- **Jahresansicht**: Zeigt alle verfügbaren Jahre (z.B. 2023, 2024, 2025, 2026) mit dem Gesamtumsatz pro Jahr

**Monatsansicht (wie bisher, aber neu gestaltet):**
- AreaChart (ausgefüllte Flächen unter der Linie) statt Balken
- 3 Linien für das ausgewählte Jahr: Handelsware (blau), Service (grün), Sonderwerkzeug (orange)
- 1 zusätzliche gestrichelte Linie für das Vorjahr — als Gesamtumsatz (grau, gestrichelt)
- Hover zeigt beide Jahre an (z.B. "Mai 2026: €1.492 | Mai 2025: €1.200")

**Jahresansicht (neu):**
- AreaChart mit den Jahren auf der X-Achse
- Jeder Punkt = Gesamtumsatz des Jahres
- Zeigt den Trend über mehrere Jahre
- Kein Vorjahresvergleich nötig, da die Jahre direkt nebeneinander liegen

### 3. API — Beide Jahre in einem Request

**Neu:** Action `getPartnerRevenueWithComparison(partnerId, year)`:
- Lädt Daten für `year` (ausgewählt) UND `year - 1` (Vorjahr)
- Gibt beide Datensätze zurück
- Sparrt einen extra Request

**Neu:** Action `getPartnerYearlyRevenue(partnerId)`:
- Lädt alle Jahre, für die Daten vorhanden sind
- Gruppiert nach Jahr und summiert die Umsätze
- Gibt Jahres-Gesamtumsätze zurück (z.B. [{year: 2023, total: 45000}, {year: 2024, total: 52000}, ...])

---

## UI-Mockup (Beschreibung)

```
┌─────────────────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│  │Gesamt    │ │Handelsw. │ │Service   │ │Rechnung.││
│  │€12.340  │ │€8.200   │ │€3.100   │ │     12  ││
│  │+15% vs25│ │+8% vs 25│ │-3% vs 25│ │         ││
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘│
├─────────────────────────────────────────────────────┤
│  Jahr: [2026 ▼]    [Monatsansicht ●] [Jahresansicht ○]│
├─────────────────────────────────────────────────────┤
│  MONATSANSICHT (AreaChart):                         │
│                                                     │
│   €12k ┤╱╲__                                       │
│   €10k ┤    ╲___    ╱╲          Vorjahr (--)       │
│    €8k ┤         ╲__╱  ╲_____    Aktuell (▒)       │
│    €6k ┤    Handelsware (blau)                      │
│    €4k ┤    Service (grün)                          │
│    €2k ┤    Sonderw. (orange)                       │
│     €0 ┼────┬────┬────┬────┬────┬────               │
│         Jan  Mär  Mai  Jul  Sep  Nov                │
│                                                     │
├─────────────────────────────────────────────────────┤
│  JAHRESANSICHT (AreaChart):                         │
│                                                     │
│   €60k ┤          ╱╲                                 │
│   €50k ┤      ╱‾‾    ╲__                            │
│   €40k ┤  ╱‾‾            ╲____                      │
│   €30k ┤╱                      ╲______              │
│   €20k ┤                              ╲_____       │
│   €10k ┤                                    ╲___    │
│     €0 ┼────┬────┬────┬────                         │
│        2023  2024  2025  2026                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Abgrenzung: Was machen wir NICHT

- Kein neues Layout für den Tab
- Keine neuen Datenbank-Tabellen
- Keine Änderung an der Materialized View
- Keine Export-Funktion (PDF/Excel)
- Keine Trend-Prognose für Zukunft

---

## Akzeptanzkriterien

- [x] Wenn ich das Jahr wechsle (z.B. 2025), ändern sich die KPI-Karten entsprechend
- [x] Jede KPI-Karte zeigt hinter dem Betrag die prozentuale Änderung zum Vorjahr
- [x] Plus-Werte sind grün, Minus-Werte sind rot, keine Änderung ist grau
- [x] Toggle zwischen Monats- und Jahresansicht funktioniert
- [x] Monatsansicht: AreaChart mit 3 Linien + gestrichelte Vorjahres-Linie
- [x] Jahresansicht: AreaChart mit Jahren auf X-Achse, Gesamtumsatz pro Jahr
- [x] Wenn keine Vorjahresdaten vorhanden sind, wird kein Vergleich angezeigt (kein Fehler)
- [x] Das Design passt sich an Mobile an (Karten 2-spaltig, Chart scrollbar)

---

## Testplan

1. **Kunde mit Daten für 2025+2026** (z.B. Tünnissen):
   - Jahr 2026 wählen → Karten zeigen 2026 + Vergleich zu 2025
   - Jahr 2025 wählen → Karten zeigen 2025 + Vergleich zu 2024
   - Monatsansicht: AreaChart + Vorjahres-Linie sichtbar
   - Jahresansicht: Zeigt alle Jahre als Trend

2. **Kunde mit Daten nur für 2026:**
   - Karten zeigen 2026 ohne Vergleich
   - Chart zeigt nur aktuelle Linien
   - Jahresansicht zeigt nur 2026

3. **Mobile:**
   - Karten werden korrekt umgebrochen (2-spaltig)
   - Chart ist scrollbar
   - Toggle ist gut bedienbar

---

## Abhängigkeiten

- PROJ-14 (Service-Role-Client für Umsatz-Daten) — bereits deployed
- Recharts `AreaChart` und `Area` Komponenten (in recharts enthalten)
- Keine neuen Packages

## Risiken

- **Risiko:** Recharts AreaChart kann auf Mobile überladen wirken mit 4 Linien. **Eindämmung:** Vorjahres-Linie ist nur 1 Linie (Gesamt), nicht 3 Kategorien.
- **Risiko:** Performance bei 2 Datenabfragen statt 1. **Eindämmung:** Beide Abfragen parallel in einer Action.
- **Risiko:** Toggle könnte auf Mobile Platzprobleme machen. **Eindämmung:** Kleine Toggle-Switches statt großen Buttons.

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/lib/actions/revenue.ts` | Neue Actions: `getPartnerRevenueWithComparison`, `getPartnerYearlyRevenue` |
| `src/app/kunden/[id]/components/revenue-chart.tsx` | BarChart → AreaChart, Vorjahres-Linie, Toggle Monat/Jahr |
| `src/app/kunden/[id]/components/revenue-summary.tsx` | Jahr-abhängig + Vorjahresvergleich in % |
| `src/app/kunden/[id]/page.tsx` | Props anpassen |

---

## Commit-Message (Vorschlag)

```
feat(PROJ-15): Vorjahresvergleich + Jahres-/Monats-Ansicht

- KPI-Karten zeigen ausgewähltes Jahr + prozentuale Änderung zum Vorjahr
- Chart: AreaChart statt Balken + gestrichelte Vorjahres-Linie
- Toggle zwischen Monats- und Jahresansicht
- Neue Actions für paralleles Laden und Jahresaggregation
```
