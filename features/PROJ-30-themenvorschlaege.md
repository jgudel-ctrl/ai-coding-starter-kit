# PROJ-30: Themenvorschläge (wöchentlich, KI-gestützt)

## Status: Planned
**Created:** 2026-07-20
**Last Updated:** 2026-07-20

> Zweiter Baustein des **Content-Epics** (PROJ-29 → **PROJ-30** → PROJ-31 → PROJ-32).
> Verbindet die Wissensbasis mit der Content-Erstellung: einmal pro Woche schlägt die KI
> **ca. 5 Themen** aus dem geprüften Wissensbestand vor — unter Berücksichtigung bereits
> behandelter Themen. Die Redaktion **gibt Themen frei**; nur freigegebene Themen gehen ins
> Content-Studio (PROJ-31).

## Dependencies
- **PROJ-1 (Auth & Rollen)** — Rolle **„Redaktion"** (+ Admin).
- **PROJ-29 (Wissensbasis)** — liefert die **geprüften** Einträge als Themen-Grundlage.
- **Speist PROJ-31 (Content-Studio)** — freigegebene Themen fließen dorthin.
- **Extern:** KI zur Themen-Generierung + Ähnlichkeits-/Dedup-Erkennung (→ `/architecture`).

## User Stories
- Als **Redakteur** möchte ich **wöchentlich ca. 5 automatisch generierte Themenvorschläge**
  erhalten, damit ich stets Content-Ideen habe, ohne selbst suchen zu müssen.
- Als **Redakteur** möchte ich pro Vorschlag **Titel, Aufhänger und Quell-Bezug** sehen, damit ich
  schnell entscheiden kann.
- Als **Redakteur** möchte ich Vorschläge **freigeben, ablehnen oder parken (später)**, damit ich
  die Auswahl steuere.
- Als **Redakteur** möchte ich, dass **abgelehnte und bereits behandelte Themen nicht erneut**
  vorgeschlagen werden, damit keine Dubletten entstehen.
- Als **Redakteur** möchte ich **eigene Themen manuell ergänzen**, damit ich spontane Ideen
  einbringen kann.
- Als **Redakteur** möchte ich **geparkte Themen** später wiederfinden und bearbeiten, damit gute
  Ideen nicht verloren gehen.

## Kern-Mechanik
1. **Rhythmus:** einmal pro Woche automatisch **ca. 5 Vorschläge** aus der geprüften Wissensbasis.
2. **Ein Vorschlag =** Titel + kurzer Aufhänger/Blickwinkel + Quell-Bezug (welche
   Wissensbasis-Einträge das Thema speisen).
3. **Drei Zustände** je Thema:
   - **Freigegeben** → geht ans Content-Studio (PROJ-31).
   - **Abgelehnt** → wird gemerkt und **nie wieder vorgeschlagen**.
   - **Geparkt / Später** → Backlog; bleibt sichtbar und kann später freigegeben/abgelehnt werden.
4. **Dedup:** neue Vorschläge berücksichtigen bereits behandelte Themen — **freigegebene,
   veröffentlichte und abgelehnte** Themen werden ausgeschlossen; geparkte bleiben im Backlog und
   werden ebenfalls nicht erneut vorgeschlagen.
5. **Manuelle Themen:** die Redaktion kann jederzeit **eigene Themen** anlegen (unabhängig von den
   Wochenvorschlägen).

## Out of Scope
- **Content-/Texterstellung** (Generierung, Tonalität, Feedback, Bilder) → **PROJ-31**.
- **Pflege der Wissensbasis** (Upload, Extraktion, Prüfung) → **PROJ-29**.
- **Veröffentlichung** auf Kanälen → **PROJ-32**.
- **Redaktionsplan / Terminierung** einzelner Artikel (wann welcher Beitrag erscheint) — nicht Teil
  dieser Spec.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang & Voraussetzung
- [ ] Angenommen ein Nutzer hat nicht die Rolle Redaktion/Admin, wenn er die Themenvorschläge
  aufruft, dann wird ihm der Zugriff verwehrt.

### Wöchentliche Generierung
- [ ] Angenommen die Wissensbasis enthält geprüfte Einträge, wenn der wöchentliche Lauf startet,
  dann werden **ca. 5** Themenvorschläge erzeugt, jeweils mit Titel, Aufhänger und Quell-Bezug.
- [ ] Angenommen ein Thema wurde bereits freigegeben, veröffentlicht oder abgelehnt, wenn neue
  Vorschläge erzeugt werden, dann taucht dieses Thema **nicht erneut** auf.
- [ ] Angenommen es gibt kaum noch unbehandelte Themen, wenn der Lauf startet, dann werden
  entsprechend **weniger als 5** (oder keine) Vorschläge erzeugt — es wird **kein** Off-Topic-Thema
  erfunden.

### Entscheidung (Freigeben / Ablehnen / Parken)
- [ ] Angenommen ein Vorschlag liegt vor, wenn der Redakteur ihn **freigibt**, dann erhält das Thema
  den Status „Freigegeben" und steht dem Content-Studio (PROJ-31) zur Verfügung.
- [ ] Angenommen ein Vorschlag liegt vor, wenn der Redakteur ihn **ablehnt**, dann wird das Thema
  gemerkt und künftig nicht mehr vorgeschlagen.
- [ ] Angenommen ein Vorschlag liegt vor, wenn der Redakteur ihn **parkt (später)**, dann landet er
  im Backlog und kann dort später freigegeben oder abgelehnt werden.

### Manuelle Themen
- [ ] Angenommen ein Redakteur hat eine eigene Idee, wenn er ein Thema manuell anlegt, dann wird es
  wie ein Vorschlag behandelt (freigeben/ablehnen/parken möglich).

### Übergabe an PROJ-31
- [ ] Angenommen ein Thema ist NICHT freigegeben, wenn im Content-Studio Content erstellt werden
  soll, dann steht dieses Thema dort **nicht** zur Auswahl (nur freigegebene Themen).

## Edge Cases
- **Wissensbasis zu klein / zu wenig unbehandelte Themen:** es werden weniger (oder keine)
  Vorschläge erzeugt; ein Hinweis erscheint statt erfundener Off-Topic-Themen.
- **Interne Dublette:** zwei sehr ähnliche Vorschläge im selben Lauf → nur einer wird gezeigt.
- **Keine Reaktion des Redakteurs über Wochen:** offene/geparkte Vorschläge bleiben erhalten; neue
  Wochenvorschläge kommen hinzu (nichts wird stillschweigend überschrieben).
- **Geparktes Thema soll doch verworfen werden:** kann jederzeit vom Backlog auf „Abgelehnt"
  gesetzt werden (und wird dann nicht mehr vorgeschlagen).
- **Manuelles Thema doppelt zu einem Vorschlag:** System weist auf Ähnlichkeit hin, damit nicht
  doppelt gearbeitet wird.

## Technical Requirements (optional)
- **Security:** nur Rollen Redaktion + Admin (RLS).
- **Zeitsteuerung:** wöchentlicher automatischer Lauf (Scheduler/Cron).
- **KI + Dedup:** Themen-Generierung und die Ähnlichkeits-/Dubletten-Erkennung (semantisch) →
  Modell/Verfahren in `/architecture`.
- **Persistenz:** Themen mit Status (vorgeschlagen/freigegeben/abgelehnt/geparkt) und Quell-Bezug.

## Open Questions
- [ ] **Trigger-Zeitpunkt** (z.B. Montagfrüh) und ob **On-Demand-Nachgenerierung** erlaubt ist.
- [ ] **Ranking/Priorisierung** der ~5 Vorschläge (z.B. nach Abdeckungslücken/Relevanz)?
- [ ] **Benachrichtigung** bei neuen Vorschlägen (ggf. über das bestehende E-Mail-Reminder-Muster).
- [ ] **Ähnlichkeits-Bestimmung** für die Dedup (rein Titel vs. semantisch über Inhalte) →
  `/architecture`.
- [ ] Werden **geparkte** Themen irgendwann automatisch wieder aktiv angeboten oder nur manuell aus
  dem Backlog geholt?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| **Ca. 5 Vorschläge/Woche** (korrigiert von ursprünglich ~20) | Überschaubare Menge, die die Redaktion realistisch wöchentlich prüfen kann | 2026-07-20 |
| Ein Vorschlag = **Titel + Aufhänger + Quell-Bezug** | Genug zum schnellen Entscheiden und als Start für PROJ-31, ohne Überladung | 2026-07-20 |
| **Drei Zustände**: Freigeben / Ablehnen / **Parken (Später)** | Redaktion braucht neben Ja/Nein eine Ablage für „gut, aber nicht jetzt" | 2026-07-20 |
| **Dedup**: freigegebene + veröffentlichte + abgelehnte Themen kommen nicht erneut | Umsetzung der Vorgabe „Berücksichtigung schon behandelter Themen" | 2026-07-20 |
| **Manuelle Themen** ergänzbar | Spontane Ideen der Redaktion sollen nicht verloren gehen | 2026-07-20 |
| Nur **freigegebene** Themen fließen in PROJ-31 | Klarer Freigabe-Gate vor jedem Content-Aufwand | 2026-07-20 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| _wird in /architecture ergänzt_ | | |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
