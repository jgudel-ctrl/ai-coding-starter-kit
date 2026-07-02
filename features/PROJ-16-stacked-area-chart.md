# PROJ-16: Gestapeltes AreaChart + Jahresansicht mit Kategorien

## Status: Deployed ✅ (2026-07-02)

## Beschreibung

Die Umsatz-Charts sollen als **gestapeltes AreaChart** dargestellt werden. Das bedeutet:
- Die einzelnen Umsatzkategorien (Handelsware, Service, Sonderwerkzeug) **summieren sich** auf der Y-Achse
- Die Chart-Fläche ist farblich unterteilt (wie ein gestapeltes Tortendiagramm, aber als Fläche über die Zeit)
- Der Gesamtumsatz ergibt sich automatisch aus der Summe der drei Schichten

Zusätzlich: Die **Jahresansicht** soll nicht nur den Gesamtumsatz zeigen, sondern auch die drei Kategorien unterscheiden.

## Motivation / Warum

- **Übersichtlicher:** Der Nutzer sieht auf einen Blick, wie sich der Gesamtumsatz zusammensetzt
- **Vergleichbar:** Man sieht sofort, welche Kategorie wie viel zum Gesamtumsatz beiträgt
- **Konsistenz:** Jahres- und Monatsansicht zeigen dieselben Informationen

## Akzeptanzkriterien

### Monatsansicht (Rolling 12 Months)
- [x] AreaChart ist gestapelt (`stackId`)
- [x] Unten: Handelsware (🟢 grün)
- [x] Darauf: Service (🟠 orange) 
- [x] Darauf: Sonderwerkzeug (🟣 lila)
- [x] Gesamthöhe = Summe aller drei Kategorien
- [x] Tooltip zeigt Einzelwerte + Summe an
- [x] Vorherige 12 Monate weiterhin als gestrichelte Linie

### Jahresansicht
- [x] Zeigt Handelsware, Service, Sonderwerkzeug als gestapelte Areas
- [x] Gleiche Farben wie Monatsansicht
- [x] Keine "Gesamtumsatz"-Linie mehr (wird durch Stacking implizit)

### KPI-Karten
- [ ] Unverändert (zeigen Einzelwerte + Vergleich)
- [ ] Farben bleiben konsistent mit Chart

## Technische Details

### Recharts Stacked AreaChart
```tsx
<Area type="monotone" dataKey="Handelsware" stackId="1" stroke="#10b981" fill="#10b981" />
<Area type="monotone" dataKey="Service" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
<Area type="monotone" dataKey="Sonderwerkzeug" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" />
```

### Datenstruktur
- Gleiche Daten wie jetzt, kein Backend-Change nötig
- Nur `stackId="1"` hinzufügen zu allen Area-Komponenten

### Dateien
- `src/app/kunden/[id]/components/revenue-chart.tsx`
- Keine Änderungen an Actions/Backend

## Offene Fragen

- [ ] Sollen die Areas teil-transparent sein (opacity), damit man die Grenzen sieht? → Ja, `fillOpacity={0.8}`
- [ ] Soll die gestrichelte Vergleichslinie auch gestapelt werden? → Nein, bleibt als einzelne gestrichelte Linie für Gesamt

## Notizen

- **Änderung:** Keine neuen Daten nötig — nur UI-Änderung im Chart
- **Risiko:** Sehr gering — nur Recharts-Konfiguration
- **Bereitgestellt:** Hotfix-fähig, aber als Feature mit Workflow dokumentiert
