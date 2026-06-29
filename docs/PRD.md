# Product Requirements Document — TMS 2.0

> Werkzeug-Management-System für Gudel Werkzeuge.
> Begleitdokumente: `docs/design-system.md` (UI-Vorgaben), `features/INDEX.md` (Feature-Tracking).

## Vision

TMS 2.0 macht den **Lebensweg jedes Werkzeugs durch die Werkstatt lückenlos sichtbar** — vom Wareneingang über Arbeitsvorbereitung, Maschine und Qualitätssicherung bis zum Warenausgang, inklusive Fremdbearbeitung extern. Jede Station sieht in Echtzeit, was bei ihr ansteht, setzt mit wenigen Touch-Aktionen den Status, und die Verwaltung erkennt auf einen Blick Durchlaufzeiten, Engpässe und Rückläufer. Ziel: Schluss mit Zetteln und Nachfragen „wo ist Werkzeug X gerade?".

## Target Users

Interne Mitarbeiter von Gudel Werkzeuge, in 7 Rollen entlang des Werkzeug-Workflows:

| Rolle | Arbeitsplatz | Kernbedürfnis |
|-------|--------------|---------------|
| **Admin/Verwaltung** | Schreibtisch | Stammdaten & Nutzer pflegen, Gesamtüberblick, Auswertungen |
| **Arbeitsvorbereitung** | Schreibtisch/Tablet | Pfad & Auftrag festlegen — bestimmt den Weg des Werkzeugs |
| **Wareneingang** | Terminal | Eingehende Werkzeuge erfassen / annehmen |
| **Werker/Maschine** | Stations-Terminal (Tablet, ggf. Handschuhe) | Sehen was ansteht, Bearbeitung starten/abschließen |
| **QS** | Stations-Terminal | Prüfen, freigeben oder als Rückläufer zurückschicken |
| **Warenausgang** | Terminal | Fertige Werkzeuge ausbuchen / versandfertig melden |
| **Fahrer** | Mobil | Transporte zu/von externer Fremdbearbeitung abwickeln |

Schmerzpunkte heute: kein zentraler Status, Suchen nach Werkzeugen, manuelle Übergaben, keine Durchlaufzeit-Transparenz.

## Werkzeug-Lebenszyklus (Kern-Workflow)

```
Wareneingang → Arbeitsvorbereitung → Maschine → QS ──→ Warenausgang
                                       ▲          │
                                       └──────────┘  (Rückläufer / Achtung)
                          Extern (Fremdbearbeitung, via Fahrer) ⇄ jederzeit einklinkbar
```

Jeder Werkzeug-Status trägt durchgängig die **Stationsfarbe** (siehe Design-System). Rückläufer (QS → Maschine) ist als Koralle/Achtung markiert.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1 · Auth & Rollen (Invite-only, 7 Rollen, RLS) | Roadmap |
| P0 (MVP) | PROJ-2 · Werkzeug-Stammdaten (Anlegen/Bearbeiten/Suche) | Roadmap |
| P0 (MVP) | PROJ-3 · Stations-Workflow & Status-Tracking (Kern) | Roadmap |
| P0 (MVP) | PROJ-4 · Stations-Arbeitslisten (was steht je Station an) | Roadmap |
| P1 | PROJ-5 · Arbeitsvorbereitung — Pfad/Auftrag festlegen | Roadmap |
| P1 | PROJ-6 · QS-Station — Prüfen, Freigabe, Rückläufer | Roadmap |
| P1 | PROJ-7 · Dashboard & Kennzahlen (Bento, Charts) | Roadmap |
| P2 | PROJ-8 · Externe Bearbeitung & Fahrer-Transporte | Roadmap |
| P2 | PROJ-9 · Benachrichtigungen (Rückläufer/Engpässe) | Roadmap |
| P2 | PROJ-10 · Dark Mode | Roadmap |

**Build-Reihenfolge & Abhängigkeiten:**
PROJ-1 (Auth/Rollen) ist Fundament für alles. → PROJ-2 (Stammdaten) liefert die Werkzeuge, die PROJ-3 (Workflow/Status) durch die Stationen bewegt. → PROJ-4 (Arbeitslisten) und PROJ-5/6 (AV/QS) bauen auf dem Workflow auf. → PROJ-7 (Dashboard) aggregiert die Daten. → PROJ-8–10 sind Erweiterungen.

## Success Metrics

- **Auffindbarkeit:** Status jedes Werkzeugs in < 5 Sek. ermittelbar (statt Suchen/Nachfragen).
- **Adoption:** Alle 7 Rollen nutzen das System im Tagesgeschäft (keine Papier-Parallelprozesse).
- **Transparenz:** Durchlaufzeit & Rückläuferquote je Station messbar im Dashboard.
- **Terminal-Tauglichkeit:** Statuswechsel an der Maschine in ≤ 2 Touch-Aktionen.

## Constraints

- **Tech:** Next.js 16 (App Router) + TypeScript, Tailwind + shadcn/ui, **self-hosted Supabase** (PostgreSQL + Auth + Storage), Deployment Docker + Traefik auf Hetzner.
- **Design:** verbindlich `docs/design-system.md` (Brand `#FF6B6D`, Bento-Layout, Mobile-First, Touch ≥ 48px).
- **Auth:** Supabase Auth, E-Mail/Passwort für alle (auch Terminals), **Invite-only** (kein Self-Signup), rollenbasierte RLS.
- **Sprache:** UI durchgehend Deutsch.

## Non-Goals (MVP)

- Keine offene Selbstregistrierung.
- Kein PIN-/Badge-Login an Terminals (bewusst vorerst voller E-Mail/Passwort-Login).
- Keine ERP-/Maschinen-Schnittstellen (manuelle Statuspflege im MVP).
- Kein Dark Mode im MVP (als P2 eingeplant).
- Keine native Mobile-App (responsive Web genügt).

---

Use `/write-spec` to create detailed feature specifications for each item in the roadmap above. Empfohlener Start: `/write-spec PROJ-1`.
