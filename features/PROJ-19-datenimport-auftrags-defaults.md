# PROJ-19: Datenimport Auftrags-Defaults

**Status:** Deployed ✅ (2026-07-03)
**Type:** Data Import / Backend Task (keine UI-Änderung)
**Priority:** P1
**Created:** 2026-07-03
**Deployed:** 2026-07-03
**Related:** PROJ-17 (Auftrags-Default UI)

---

## Problem Statement

Die Tabelle `tms.partner_order_defaults` wurde in PROJ-17 mit den Spalten `driver_id` und `pickup_cycle_count` erweitert, ist aber noch leer. Für die praktische Nutzung der Auftrags-Default-Funktion müssen existierende Kunden mit ihren Fahrer-Zuordnungen und Abholzyklen befüllt werden.

## Quelldaten

CSV-Datei mit 123 Datensätzen:
- **Kundennummer** → Matching mit `tms.partners.customer_number`
- **Fahrer** → Email-Adresse → Lookup in `public.profiles` → `driver_id`
- **Wochenrhythmus** → `pickup_cycle_count` (Integer, 0–52)
- **Status Hol- und Bringdienst** → Für alle "Automatisch" (informativ)

**Spezialfälle:**
- Wochenrhythmus = 0 → wahrscheinlich "kein Abholservice" oder manuell
- 3 verschiedene Fahrer-Emails: c.gudel@, m.gudel@, j.gudel@

---

## Acceptance Criteria

### Functional Requirements

| # | Requirement | How to Verify |
|---|-------------|---------------|
| 1 | Alle 123 CSV-Datensätze sind verarbeitet | Count-Query in `partner_order_defaults` |
| 2 | Jeder Datensatz ist korrekt mit `partners.customer_number` verknüpft | Join-Query prüft `partner_id` |
| 3 | `driver_id` korrekt aus `profiles.email` aufgelöst | Cross-Check mit CSV-Fahrer-Email |
| 4 | `pickup_cycle_count` entspricht CSV-Wochenrhythmus | Direkter Wertvergleich |
| 5 | Nicht-matchende Kundennummern werden geloggt | Log-Datei mit Fehlenden IDs |
| 6 | Nicht-matchende Fahrer-Emails werden geloggt | Log-Datei mit unbekannten Emails |
| 7 | Import ist idempotent (mehrfaches Ausführen = gleiches Ergebnis) | UPSERT statt INSERT |

### Technical Requirements

| # | Requirement | Notes |
|---|-------------|-------|
| 8 | SQL-Script für den Import | ✅ `scripts/import_auftrags_defaults.sql` |
| 9 | Transaktionssicherheit | ✅ `BEGIN...COMMIT` |
| 10 | Keine Duplikate bei wiederholtem Import | ✅ `ON CONFLICT (partner_id) UPDATE` |

---

## Data Mapping

```
CSV                     → Database
─────────────────────────────────────────────────────────
Kundennummer            → partners.customer_number → partner_id
Fahrer (Email)          → profiles.email → profiles.id → driver_id
Wochenrhythmus          → pickup_cycle_count
```

### Transformations

- `Wochenrhythmus = 0` → `pickup_cycle_count = NULL` (oder 0, je nach Semantik)
- `Wochenrhythmus > 52` → Validation-Error (Constraint: `CHECK (pickup_cycle_count <= 52)`)
- Nicht gefundene `customer_number` → Log + Skip
- Nicht gefundene `Fahrer` Email → Log + `driver_id = NULL`

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Kundennummer existiert nicht in DB | Medium | Low | Loggen, überspringen |
| Fahrer-Email existiert nicht in DB | Medium | Medium | Loggen, `driver_id = NULL` |
| CSV-Format abweichend | Low | High | Validierung vor Import |
| Wochenrhythmus > 52 | Low | Low | Constraint blockiert, Log |

---

## Out of Scope

- UI für Import (wird als One-Time-Task via SQL/Script durchgeführt)
- Automatisierter wiederkehrender Import (CSV-Upload)
- Validierung der Kundennummern gegen externes System

---

## Success Criteria

- 123 Einträge in `tms.partner_order_defaults` mit korrekten Daten
- Max. 5% nicht auflösbare Kundennummern (akzeptabel)
- Max. 10% nicht auflösbare Fahrer (werden ohne Fahrer importiert)

## Backend Implementation

**SQL-Script:** `scripts/import_auftrags_defaults.sql`

### Script-Features:
- **Temporäre Tabelle** für CSV-Daten
- **Preview** nicht-auflösbarer Kundennummern und Fahrer-Emails
- **UPSERT** (`ON CONFLICT UPDATE`) für Idempotenz
- **Transaktionssicher** (`BEGIN...COMMIT`)
- **Transformations:**
  - `Wochenrhythmus = 0` → `pickup_cycle_count = NULL`
  - `Wochenrhythmus > 0` → `pickup_enabled = TRUE`
- **Logging** via `RAISE NOTICE`
- **Statistik** am Ende mit COUNT-Auswertungen

## Deployment Results

| Metrik | Wert |
|--------|------|
| CSV-Datensätze | 114 (Duplikate entfernt) |
| Erfolgreich importiert | **113** |
| Mit Fahrer zugewiesen | 106 |
| Mit Abholzyklus | 111 |

### Nicht importiert (akzeptabel)

| Problem | Grund |
|---------|-------|
| Kundennummer `12588` | Existiert nicht in DB |
| Fahrer `j.gudel@` | Noch kein User-Account in App (kann später nachgeholt werden) |

### Script
`scripts/import_auftrags_defaults.sql` — Idempotent, kann bei Bedarf wiederholt werden.

---

## Notes

- Backup vor Import empfohlen
- Test auf Staging erst, dann Production
- CSV liegt unter `/home/botti/.openclaw/workspace/data/kunden_fahrer_wochenrhythmus.csv`
