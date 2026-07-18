# Feature Index

Übersicht aller Features und deren Status.

## Legende

- **🔵 Planned** — Geplant, noch nicht gestartet
- **🟡 In Progress** — In Bearbeitung
- **🟠 In Review** — Wartet auf Review/Freigabe
- **✅ Deployed** — Live

---

## Features

| ID | Name | Status | Letzte Änderung |
|----|------|--------|-----------------|
| PROJ-1 | Auth & Rollen | ✅ Deployed | 2026-06-18 |
| PROJ-11 | Kundendetailseite | ✅ Deployed — Bestellhistorie-Erweiterung (Produkttyp-Filter, Gruppierung, Donut-Chart) am 2026-07-18 live verifiziert (Tabelle + Donut = 129 Positionen bei Bod'or KTM, Preise/Rechnungsnr./Filter korrekt). BUG-4/5/6 + Cent→Euro + Pagination behoben. Details: Spec „Deploy-Verlauf 2026-07-18" | 2026-07-18 |
| PROJ-14 | Umsatz-Service-Icon Fix | ✅ Deployed | 2026-07-02 |
| PROJ-15 | Vorjahresvergleich + Ansichten | ✅ Deployed | 2026-07-02 |
| PROJ-16 | Gestapeltes AreaChart | ✅ Deployed | 2026-07-02 |
| PROJ-17 | Auftrags-Default im Kunden-Detail | ✅ Deployed | 2026-07-03 |
| PROJ-18 | Globaler Header mit Navigation | ✅ Deployed | 2026-07-03 |
| PROJ-19 | Auftragsverwaltung | ✅ Deployed | 2026-07-05 |
| PROJ-20 | Logistik & Abholung | ✅ Deployed | 2026-07-06 |
| PROJ-21 | Fahrer-Seite | ✅ Deployed | 2026-07-06 |
| PROJ-22 | Kalender für blockierte Tage | ✅ Deployed | 2026-07-07 |
| PROJ-28 | Hersteller-Verwaltung & Artikel-Zuordnung | ✅ Deployed | 2026-07-10 |

## Architektur-Dokumente

| Feature | Architektur |
|---------|-------------|
| PROJ-11 | PROJ-11-architektur.md |
| PROJ-14 | PROJ-14-architektur.md |
| PROJ-15 | PROJ-15-architektur.md |
| PROJ-16 | PROJ-16-architektur.md |
| PROJ-18 | PROJ-18-architektur.md |
| PROJ-19 | PROJ-19-architektur.md |

---

## Workflow-Regeln (gültig ab 2026-06-30)

```
/init → /write-spec → User-Review ("approved") →
/architecture → User-Review ("approved") →
/frontend → /backend → /qa → /deploy
```

- Nach `/write-spec` und nach `/architecture` **IMMER** auf explizites "approved" vom User warten.
- Ausnahme: **Trivialer Hotfix** — NUR wenn das Wort "Hotfix" explizit verwendet wird.
- Vor jeder Code-Änderung: CLAUDE.md, docs/PRD.md und relevante Feature-Datei lesen.
- Status in INDEX.md und Feature-Header immer synchron halten.

## Next Available ID: PROJ-29
