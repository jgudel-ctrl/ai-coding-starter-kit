# PROJ-16 Architektur: Gestapeltes AreaChart

## Status: Approved → Implementierung

## Änderungen

### revenue-chart.tsx
- **Monatsansicht:** `stackId="1"` zu allen drei Area-Komponenten hinzufügen
  - Handelsware (stackId="1", fill="#10b981")
  - Service (stackId="1", fill="#f59e0b") 
  - Sonderwerkzeug (stackId="1", fill="#8b5cf6")
  - Gradienten entfernen (beim Stacking sehen sie komisch aus)
  - Vorherige-12M-Linie bleibt ungestapelt (gestrichelt)
  
- **Jahresansicht:** Statt einzelner "Gesamtumsatz"-Area:
  - Handelsware + Service + Sonderwerkzeug als gestapelte Areas
  - Gleiche Farben + stackId wie Monatsansicht

### Keine Backend-Änderungen
- Gleiche Datenstruktur, gleiche Actions
- Nur UI-Rendering ändert sich

## Risiko: Minimal
