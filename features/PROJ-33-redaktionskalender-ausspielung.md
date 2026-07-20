# PROJ-33: Redaktionskalender & Ausspielung

## Status: Planned
**Created:** 2026-07-20
**Last Updated:** 2026-07-20

> Letzter Baustein des **Content-Epics** (PROJ-29 → PROJ-30 → PROJ-31 → PROJ-32 → **PROJ-33**).
> Nimmt die **freigegebenen Content-Pieces** (aus PROJ-32), **terminiert** sie in einem
> Redaktionskalender (mit automatischem Wochen-Vorschlag nach Kanal-Best-Practice) und **spielt sie
> zum geplanten Zeitpunkt** über einen angebundenen **Publishing-Dienst** (z.B. Buffer/Metricool)
> auf die Kanäle aus.

## Dependencies
- **PROJ-1 (Auth & Rollen)** — Rolle **„Redaktion"** (+ Admin).
- **PROJ-32 (Multi-Channel-Content-Studio)** — liefert die **freigegebenen Content-Pieces**.
- **Extern:** **Publishing-Dienst** (Buffer/Metricool o.ä.) übernimmt die tatsächlichen
  Kanal-Integrationen (Instagram/Facebook/LinkedIn). Auswahl → `/architecture`.
- **Blog (eigene Website):** Anbindung offen (über den Dienst oder direkt) → `/architecture`.

## User Stories
- Als **Redakteur** möchte ich freigegebene Pieces in einem **Kalender terminieren**, damit die
  Ausspielung geplant und gleichmäßig abläuft.
- Als **Redakteur** möchte ich einen **automatischen Wochen-Vorschlag** nach Best-Practice-Kadenz,
  damit jede Woche genug läuft, ohne dass ich alles selbst plane.
- Als **Redakteur** möchte ich per **Drag & Drop** verschieben/entfernen, damit ich den Plan
  anpassen kann.
- Als **Redakteur** möchte ich, dass die Pieces zum Termin **automatisch über den Publishing-Dienst
  ausgespielt** werden, damit ich nicht manuell posten muss.
- Als **Redakteur** möchte ich sehen, was **geplant, ausgespielt oder fehlgeschlagen** ist, damit
  ich den Überblick behalte.
- Als **Admin** möchte ich die **Best-Practice-Kadenz je Kanal** einstellen, damit der Vorschlag zu
  unserer Strategie passt.

## Kern-Mechanik
1. **Nur freigegebene Pieces** (aus PROJ-32) sind terminierbar.
2. **Auto-Wochen-Vorschlag:** der Kalender füllt die Woche nach **Kanal-Best-Practice-Kadenz**
   (z.B. Newsletter 1×/Woche, Instagram-Reel 3–4×/Woche, LinkedIn 2–3×/Woche …).
3. **Drag & Drop:** Termine verschieben, Pieces entfernen, Lücken füllen.
4. **Ausspielung zum Termin** über den angebundenen Publishing-Dienst (Social); Blog ggf. separat.
5. **Status je geplantem Post:** *geplant → ausgespielt* bzw. *fehlgeschlagen* (mit Wiederholung).
6. **Kadenz-Regeln je Kanal** sind vom Admin pflegbar.

## Out of Scope
- **Content-Piece-Erzeugung, Vorschau, Freigabe** → PROJ-32.
- **Themen/Artikel** → PROJ-30/31.
- **Reichweiten-/Performance-Analyse** der veröffentlichten Posts (Analytics) — nicht in dieser Spec
  (mögliche spätere Erweiterung).
- **Eigenbau aller Plattform-Integrationen** — das übernimmt der Publishing-Dienst.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang & Voraussetzung
- [ ] Angenommen ein Nutzer hat nicht die Rolle Redaktion/Admin, wenn er den Kalender öffnet, dann
  wird ihm der Zugriff verwehrt.
- [ ] Angenommen ein Piece ist NICHT freigegeben, wenn es terminiert werden soll, dann ist das nicht
  möglich (nur freigegebene Pieces).

### Kalender & Auto-Vorschlag
- [ ] Angenommen es liegen freigegebene Pieces vor, wenn der Redakteur den Wochen-Vorschlag auslöst,
  dann verteilt der Kalender die Pieces automatisch nach der hinterlegten Kanal-Kadenz.
- [ ] Angenommen ein Wochen-Vorschlag liegt vor, wenn der Redakteur ein Piece per Drag & Drop
  verschiebt oder entfernt, dann wird der Plan entsprechend aktualisiert.
- [ ] Angenommen es gibt zu wenige freigegebene Pieces, um die Woche best-practice-konform zu füllen,
  wenn der Vorschlag erzeugt wird, dann zeigt der Kalender die Lücken mit Hinweis „mehr Content
  nötig".

### Ausspielung
- [ ] Angenommen ein Piece ist für einen Zeitpunkt geplant, wenn dieser Zeitpunkt erreicht ist, dann
  wird das Piece über den Publishing-Dienst auf den Kanal ausgespielt und als „ausgespielt" markiert.
- [ ] Angenommen der Publishing-Dienst ist zum Termin nicht erreichbar, wenn die Ausspielung
  fehlschlägt, dann wird der Post als „fehlgeschlagen" markiert, ein Hinweis ausgegeben und ein
  erneuter Versuch ist möglich.

### Kadenz-Pflege
- [ ] Angenommen ein Admin passt die Kadenz eines Kanals an, wenn er speichert, dann berücksichtigt
  der nächste Wochen-Vorschlag die neuen Werte.

## Edge Cases
- **Publishing-Dienst nicht erreichbar:** Fehlerstatus + Wiederholung + Hinweis; kein stiller Ausfall.
- **Zu wenige Pieces für die Woche:** Kalender zeigt Lücken statt Content zu erzwingen.
- **Piece wird nach Terminierung zurückgezogen** (in PROJ-32 geändert/verworfen): es wird aus dem
  Plan genommen bzw. der Termin als ungültig markiert.
- **Verpasster Termin** (z.B. System-Ausfall): Hinweis; nachträglich ausspielen oder verwerfen.
- **Überbelegung** (zu viel an einem Tag/Kanal): Best-Practice-Warnung.
- **Zeitzonen:** geplante Zeiten eindeutig (Europe/Berlin) anzeigen und ausspielen.

## Technical Requirements (optional)
- **Security:** nur Rollen Redaktion + Admin (RLS).
- **Anbindung Publishing-Dienst** (API); konkreter Dienst + abgedeckte Kanäle → `/architecture`.
- **Scheduler** für die Ausspielung zum geplanten Zeitpunkt (zuverlässig, mit Retry).
- **Blog-Anbindung** (eigene Website) → `/architecture`.
- **Persistenz:** geplante Posts mit Zeitpunkt, Kanal, Status (geplant/ausgespielt/fehlgeschlagen),
  Verweis auf das Piece; Kadenz-Regeln je Kanal.

## Open Questions
- [ ] **Welcher Publishing-Dienst** konkret (Buffer/Metricool/Publer …), Kosten, welche Kanäle deckt
  er ab? → `/architecture`.
- [ ] **Blog (eigene Website):** über den Dienst oder direkte Anbindung (CMS/Headless)?
- [ ] **Best-Practice-Kadenz-Startwerte** je Kanal (Defaults)?
- [ ] **Benachrichtigung** bei Ausspielungs-Fehlern (ggf. über das bestehende E-Mail-Reminder-Muster).
- [ ] **Freigabe des Wochenplans** nötig, oder gilt der Drag & Drop-Zustand direkt als verbindlich?
- [ ] **Analytics/Reichweite** später aufnehmen (Performance je Post/Kanal)?

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| **Ausspielung über angebundenen Publishing-Dienst** (nicht Eigenbau je Plattform) | Nimmt die aufwändigen, teils genehmigungspflichtigen Plattform-Integrationen ab; schnell nutzbar | 2026-07-20 |
| **Kalender: Auto-Wochen-Vorschlag nach Best-Practice + Drag & Drop** | Vorschlag spart Planungsaufwand, manuelle Kontrolle bleibt | 2026-07-20 |
| **Kadenz je Kanal admin-pflegbar** | Strategie ändert sich; Redaktion soll Frequenz selbst steuern | 2026-07-20 |
| **Nur freigegebene Pieces** terminierbar | Klare Grenze zu PROJ-32; nichts Ungeprüftes geht live | 2026-07-20 |
| **Status-Tracking** geplant/ausgespielt/fehlgeschlagen (+ Retry) | Überblick und Fehlersicherheit beim Ausspielen | 2026-07-20 |
| Kalender & Ausspielung als **eigenes Feature** (Split aus PROJ-32) | Content-Erzeugung unabhängig vom (aufwändigen) Kanal-Anschluss testbar/deploybar | 2026-07-20 |

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
