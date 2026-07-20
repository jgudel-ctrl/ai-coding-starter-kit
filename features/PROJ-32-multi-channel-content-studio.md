# PROJ-32: Multi-Channel-Content-Studio

## Status: Planned
**Created:** 2026-07-20
**Last Updated:** 2026-07-20

> Vierter Baustein des **Content-Epics** (PROJ-29 → PROJ-30 → PROJ-31 → **PROJ-32** → PROJ-33).
> Macht aus **einem freigegebenen Artikel** (PROJ-31) per **Klick** die passenden **Content-Pieces
> für alle Kanäle** — jeweils nach Best Practice angepasst (gekürzt/erweitert/aufgeteilt). Jedes
> Piece wird in **kanalgetreuer Vorschau** angezeigt und durchläuft **dieselbe Iterationsschleife
> wie in PROJ-31** (Tonalität-Regler + fachliches Freitext-Feedback), bis es freigegeben und
> gespeichert ist. Das **Terminieren & Ausspielen** übernimmt danach **PROJ-33**.

## Dependencies
- **PROJ-1 (Auth & Rollen)** — Rolle **„Redaktion"** (+ Admin).
- **PROJ-31 (Content-Studio)** — liefert den **freigegebenen Kern-Artikel** und die
  **Generierungs-/Iterations-Engine** (Regler + fachlicher Freitext + Lern-Speicher), die hier
  **pro Piece wiederverwendet** wird.
- **PROJ-29 (Wissensbasis)** — Faktengrundlage (über den Artikel).
- **Speist PROJ-33 (Redaktionskalender & Ausspielung)** — freigegebene Pieces werden dort
  terminiert und veröffentlicht.
- **Extern:** KI-Textgenerierung + Bildvorschläge (→ `/architecture`).

## User Stories
- Als **Redakteur** möchte ich aus einem freigegebenen Artikel **mit einem Klick alle
  Kanal-Content-Pieces** erzeugen, damit ich nicht jeden Post einzeln schreiben muss.
- Als **Redakteur** möchte ich jedes Piece in **kanalgetreuer Vorschau** sehen, damit ich weiß, wie
  es später wirkt.
- Als **Redakteur** möchte ich pro Piece **Tonalität (Regler) und Fakten (Freitext) anpassen und neu
  erzeugen** — wie beim Artikel — damit jedes Piece passt.
- Als **Redakteur** möchte ich **jedes Piece einzeln freigeben**, damit nur Geprüftes gespeichert
  wird.
- Als **Redakteur** möchte ich für Reels ein **Skript + Caption + Bildvorschläge** erhalten, damit
  ich das Video effizient selbst produzieren kann.

## Kern-Mechanik
1. **Ein-Klick-Erzeugung:** Aus dem freigegebenen Artikel werden für **alle MVP-Kanäle** Pieces
   erzeugt, jeweils **nach Best Practice** angepasst (gekürzt/erweitert/aufgeteilt).
2. **Mehrere Pieces pro Kanal möglich:** Ein Thema kann z.B. **mehrere Reels** oder ein Karussell
   ergeben.
3. **Kanalgetreue Vorschau** je Piece (so, wie es später aussieht).
4. **Iterationsschleife je Piece = identisch zu PROJ-31:** 🎚️ Regler = Tonalität, ✍️ Freitext =
   **nur fachliche Korrektur** → neu erzeugen → **freigeben**. Nutzt dieselbe Engine **und denselben
   Lern-Speicher** wie PROJ-31.
5. **Freigabe + Speicherung je Piece** → bereit für PROJ-33.
6. **Reels/Video:** ein Piece = **Skript/Storyboard + Caption + Bild-/Szenen-Vorschläge** — **kein**
   fertiges Video (das produziert das Team selbst).
7. **Harte Regeln bleiben:** **keine Marke** genannt (neutral); Sie-Form als Standard (kanalweise
   Best-Practice-Anpassung von Länge/Format, siehe Open Questions).

### MVP-Kanäle
- **Webseiten-Blog** · **E-Mail-Newsletter** · **LinkedIn** · **Instagram** (Post + Reel) ·
  **Facebook** (Post + Reel).
- Später: X/Twitter, TikTok, YouTube Shorts, weitere.

## Out of Scope
- **Terminierung, Redaktionskalender & tatsächliches Ausspielen** → **PROJ-33**.
- **Fertige Video-/Reel-Produktion** — nur Skript/Caption/Bildvorschläge, kein generiertes Video.
- **Kanäle über die MVP-Liste hinaus** (X/Twitter, TikTok, YouTube Shorts …) — später.
- **Artikel-Erstellung selbst** (Kern-Text) → PROJ-31.
- **Themenauswahl** → PROJ-30.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang & Voraussetzung
- [ ] Angenommen ein Nutzer hat nicht die Rolle Redaktion/Admin, wenn er das Multi-Channel-Studio
  öffnet, dann wird ihm der Zugriff verwehrt.
- [ ] Angenommen ein Artikel ist NICHT freigegeben (PROJ-31), wenn Content-Pieces erzeugt werden
  sollen, dann ist das nicht möglich (nur freigegebene Artikel).

### Erzeugung
- [ ] Angenommen ein freigegebener Artikel liegt vor, wenn der Redakteur „Content-Pieces erzeugen"
  klickt, dann werden für alle MVP-Kanäle passende, best-practice-angepasste Pieces erstellt.
- [ ] Angenommen ein Thema eignet sich für mehrere Formate, wenn Pieces erzeugt werden, dann können
  pro Kanal **mehrere** Pieces entstehen (z.B. mehrere Reels).
- [ ] Angenommen ein Reel-Piece wird erzeugt, wenn es erscheint, dann enthält es **Skript, Caption
  und Bild-/Szenen-Vorschläge**, aber **kein fertiges Video**.
- [ ] Angenommen ein Piece wird erzeugt, wenn es erscheint, dann enthält es **keinen Markennamen**
  (neutral).
- [ ] Angenommen die Erzeugung eines Kanals schlägt fehl, wenn die anderen erfolgreich sind, dann
  werden die erfolgreichen angezeigt und die fehlgeschlagenen sind einzeln erneut auslösbar.

### Vorschau & Iteration
- [ ] Angenommen Pieces wurden erzeugt, wenn der Redakteur ein Piece öffnet, dann sieht er eine
  **kanalgetreue Vorschau** (wie es später aussieht).
- [ ] Angenommen ein Piece passt tonal noch nicht, wenn der Redakteur einen Regler ändert und neu
  erzeugen lässt, dann ändert sich der Stil entsprechend.
- [ ] Angenommen ein Piece enthält einen fachlichen Fehler, wenn der Redakteur ihn im Freitextfeld
  richtigstellt und neu erzeugen lässt, dann wird das Piece korrigiert neu erstellt — und die
  Korrektur fließt (wie in PROJ-31) in den Lern-Speicher.

### Freigabe & Speicherung
- [ ] Angenommen ein Piece passt, wenn der Redakteur es freigibt, dann wird es gespeichert und steht
  PROJ-33 (Terminierung/Ausspielung) zur Verfügung.
- [ ] Angenommen mehrere Pieces gehören zu einem Artikel, wenn der Redakteur einzelne freigibt und
  andere noch bearbeitet, dann bleiben die Status je Piece unabhängig nachvollziehbar.

## Edge Cases
- **Artikel zu kurz/dünn** für ein langes Blog-Format oder viele Reels: es werden weniger Pieces
  erzeugt, **kein** Auffüllen mit Fülltext.
- **Kanal passt nicht** zum Thema: das Piece wird übersprungen (mit Hinweis) statt erzwungen.
- **Teilweiser Fehlschlag** der Erzeugung: erfolgreiche Pieces bleiben erhalten, fehlgeschlagene
  einzeln wiederholbar.
- **Marke rutscht in ein Piece:** muss abgefangen/verhindert werden (Neutralitäts-Regel).
- **Redakteur verwirft ein einzelnes Piece**, behält die anderen: möglich ohne Neu-Erzeugung aller.

## Technical Requirements (optional)
- **Security:** nur Rollen Redaktion + Admin (RLS).
- **Wiederverwendung:** Generierungs-/Iterations-Engine + Lern-Speicher aus **PROJ-31**.
- **Speicherung:** Pieces je Artikel/Kanal mit Status, Iterations-Historie, Bildvorschlägen
  (Supabase Storage).
- **Vorschau:** kanalgetreue Vorschau-Komponenten (Optik der jeweiligen Plattform).
- **KI + Bildvorschläge:** Modelle/Verfahren → `/architecture`.

## Open Questions
- [ ] **Tonalität je Kanal:** überall Sie-Form, oder auf Social lockerer/„Du"? (Standard bis auf
  Weiteres: Sie + neutral; Best-Practice-Anpassung betrifft v.a. Länge/Format.)
- [ ] **Maximale Anzahl Pieces pro Kanal** (z.B. wie viele Reels pro Thema)?
- [ ] **Bildvorschläge:** KI-generiert, aus einer Bibliothek, oder beides?
- [ ] **Kanalgetreue Vorschau:** wie originalgetreu wird die Plattform-Optik nachgebaut?
- [ ] **Best-Practice-Regeln je Kanal:** fest hinterlegt oder von Admins pflegbar?
- [ ] **Weitere Kanäle** (X/Twitter, TikTok, YouTube Shorts …) — Reihenfolge/Zeitpunkt.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| **Ein Klick → alle Kanal-Pieces** automatisch, best-practice-angepasst | Kernnutzen: aus einem Artikel effizient vielfältigen Kanal-Content machen | 2026-07-20 |
| **Iterationsschleife je Piece = identisch zu PROJ-31** (Regler + fachlicher Freitext, Lern-Speicher) | Konsistente Redaktions-Erfahrung, Engine-Wiederverwendung | 2026-07-20 |
| **Kanalgetreue Vorschau** je Piece | Redakteur soll sehen, wie es später wirklich aussieht | 2026-07-20 |
| **Reels = Skript + Caption + Bildvorschläge, kein fertiges Video** | KI-Video ist teuer/unausgereift; Team produziert Video selbst | 2026-07-20 |
| **MVP-Kanäle:** Blog, Newsletter, LinkedIn, Instagram (Post+Reel), Facebook (Post+Reel) | Wichtigste Kanäle breit; X & weitere später | 2026-07-20 |
| **Freigabe + Speicherung je Piece**; Terminierung/Ausspielung = PROJ-33 | Klare Trennung Content-Erzeugung ↔ Kalender/Publishing | 2026-07-20 |
| PROJ-32 (Publishing) in **PROJ-32 (Content-Pieces)** + **PROJ-33 (Kalender & Ausspielung)** gesplittet | Ursprüngliche Idee zu groß für eine testbare Einheit | 2026-07-20 |

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
