# PROJ-29: Wissensbasis (KI-Content-Fundament)

## Status: Planned
**Created:** 2026-07-20
**Last Updated:** 2026-07-20

> Erstes Feature des **Content-Epics** (PROJ-29 → PROJ-30 → PROJ-31 → PROJ-32).
> Ziel des Epics: eine große, geprüfte Datenbank an Texten & Bildern zu Themen der
> Holzwerkstoff-Zerspanung aufbauen und daraus Content-Marketing (Blog, Social
> Media, Newsletter) für Schreiner/Tischler betreiben. **Diese Spec baut nur das
> Fundament: die strukturierte, geprüfte Wissensbasis aus technischen Quelldaten.**

## Dependencies
- **PROJ-1 (Auth & Rollen)** — muss um eine neue Rolle **„Redaktion"** erweitert
  werden (getrennt von den 7 Werkstatt-Rollen). Diese Erweiterung ist Voraussetzung.
- **Supabase Storage** — zum Ablegen der hochgeladenen Quell-PDFs (bereits im Stack).
- Nachgelagerte Epic-Teile bauen hierauf auf: PROJ-30 (Themenvorschläge),
  PROJ-31 (Artikel-Werkstatt), PROJ-32 (Publishing).

## User Stories
- Als **Redakteur** möchte ich Hersteller-PDFs/Dokumente hochladen, damit die KI
  daraus strukturierte Wissens-Einträge vorschlägt und ich nicht alles abtippen muss.
- Als **Redakteur** möchte ich jeden KI-vorgeschlagenen Eintrag prüfen, korrigieren
  und auf „Geprüft" setzen, damit nur verlässliches Wissen in die Basis gelangt.
- Als **Redakteur** möchte ich die Wissensbasis nach Werkzeugart, Material, Status
  und im Volltext durchsuchen/filtern, damit ich schnell den passenden Eintrag finde.
- Als **Redakteur** möchte ich zu jedem Eintrag die Quelle (Hersteller + Seite) und
  den Originaltext-Auszug sehen, damit ich Fakten belegen und nachprüfen kann.
- Als **Admin** möchte ich die Kategorien (Werkzeugart, Material) pflegen, damit die
  Taxonomie zum Sortiment und zu neuen Themen passt.

## Out of Scope
<!-- Bewusst NICHT Teil dieser Spec — gehört zu späteren Epic-Teilen. -->
- **Wöchentliche Themenvorschläge** aus der Wissensbasis → **PROJ-30**
- **Artikel-Text- & Bildgenerierung** und der **Lern-Loop** (Korrekturen verbessern
  den Start-Prompt) → **PROJ-31**
- **Veröffentlichung** auf Blog / Social Media / Newsletter → **PROJ-32**
- **Automatisches Web-Scraping** von Hersteller-Websites (nur manueller Upload im MVP)
- **Verknüpfung Wissens-Eintrag ↔ konkretes Produkt/SKU** aus PROJ-28 (bewusst
  entkoppelt; ggf. später als optionale Verlinkung)
- **Kundenseitige / öffentliche Ansicht** der Wissensbasis (rein internes Werkzeug)
- **Themen außerhalb des Scopes:** ausschließlich Zerspanungswerkzeuge (Sägen,
  Fräser, Bohrer) für die Materialien Holz, Kunststoff, Aluminium — alles andere
  wird nicht erfasst.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang & Rollen
- [ ] Angenommen ein Nutzer hat NICHT die Rolle Redaktion oder Admin, wenn er die
  Wissensbasis-Seite aufruft, dann wird ihm der Zugriff verwehrt (keine Anzeige/Aktion).
- [ ] Angenommen ein Nutzer hat die Rolle Redaktion, wenn er die Wissensbasis öffnet,
  dann kann er Einträge sehen, hochladen, prüfen und bearbeiten.

### Upload & KI-Extraktion
- [ ] Angenommen die Wissensbasis wird erstmalig eingerichtet, wenn sie startet, dann
  ist zunächst nur das **Leitz-Lexikon** als Quelle hinterlegt, und weitere
  Hersteller-Dokumente können **jederzeit** ergänzt werden.
- [ ] Angenommen ein Redakteur ist eingeloggt, wenn er ein PDF/Dokument hochlädt,
  dann wird die Datei gespeichert und die KI extrahiert daraus Eintrags-Vorschläge.
- [ ] Angenommen die KI hat ein PDF verarbeitet, wenn die Extraktion fertig ist, dann
  erscheinen die Vorschläge als Einträge im Status „Entwurf" mit vorbefüllten Feldern.
- [ ] Angenommen ein hochgeladenes PDF ist unlesbar/beschädigt, wenn die Extraktion
  fehlschlägt, dann wird eine verständliche Fehlermeldung angezeigt und keine
  fehlerhaften Einträge angelegt.

### Eintrag & Felder
- [ ] Angenommen ein Eintrag wird angelegt, wenn er gespeichert wird, dann enthält er
  mindestens: Titel/Begriff, Werkzeugart, Material, technische Kennwerte,
  Beschreibungstext (destilliert), Originaltext-Auszug, Quelle (Hersteller + Seite),
  Status.
- [ ] Angenommen ein Redakteur bearbeitet einen Eintrag, wenn er speichert, dann
  werden die Änderungen übernommen und der Änderungszeitpunkt festgehalten.
- [ ] Angenommen ein Eintrag hat keine Werkzeugart oder kein Material gesetzt, wenn der
  Redakteur ihn auf „Geprüft" setzen will, dann wird eine Validierungsmeldung angezeigt
  (Pflichtfelder für „Geprüft").

### Freigabe-Status (Entwurf → Geprüft)
- [ ] Angenommen ein Eintrag ist im Status „Entwurf", wenn ein Redakteur ihn prüft und
  auf „Geprüft" setzt, dann gilt er als verlässlicher Bestandteil der Wissensbasis.
- [ ] Angenommen nur geprüfte Einträge sollen später Themen/Artikel speisen, wenn die
  Basis abgefragt wird, dann sind „Entwurf"-Einträge klar als solche gekennzeichnet
  und getrennt filterbar.
- [ ] Angenommen ein KI-Vorschlag ist falsch/unbrauchbar, wenn der Redakteur ihn
  verwirft/löscht, dann wird er aus der Basis entfernt und zählt nicht.

### Suche & Filter
- [ ] Angenommen es existieren Einträge, wenn ein Redakteur nach Werkzeugart, Material
  oder Status filtert, dann werden nur passende Einträge angezeigt.
- [ ] Angenommen es existieren Einträge, wenn ein Redakteur einen Suchbegriff eingibt,
  dann werden Einträge mit Treffern in Titel/Beschreibung/Quelle angezeigt.
- [ ] Angenommen die Wissensbasis ist leer, wenn ein Redakteur sie öffnet, dann sieht
  er einen Leerzustand mit Hinweis „Erstes Dokument hochladen".

## Edge Cases
- **Unlesbares/leeres PDF:** Extraktion schlägt fehl → Fehlermeldung, keine Einträge.
- **Off-Topic-Dokument** (nicht Zerspanung/Holz-Kunststoff-Alu): KI sollte wenige/keine
  Einträge vorschlagen; Redakteur kann irrelevante Vorschläge verwerfen.
- **Dublette:** Dieselbe Kennzahl/derselbe Begriff taucht in mehreren Hersteller-PDFs
  auf → Einträge bleiben zunächst getrennt (mit Hersteller-Quelle), Redakteur kann sie
  später zusammenführen/verknüpfen. (Merge-Automatik = Open Question.)
- **Sehr großes PDF** mit vielen Themen → Extraktion darf dauern; Fortschritt/Status
  sichtbar, kein Timeout-Abbruch ohne Rückmeldung.
- **Gleichzeitige Bearbeitung** eines Eintrags durch zwei Redakteure → letzter
  Speichervorgang gewinnt, aber es darf kein stiller Datenverlust ohne Hinweis passieren.
- **Fehlende technische Kennwerte** in der Quelle → Eintrag darf als „Entwurf"
  gespeichert werden, aber „Geprüft" erfordert die Pflichtfelder.

## Technical Requirements (optional)
- **Security:** Nur Rollen Redaktion + Admin (RLS). Rein internes Tool.
- **Datei-Ablage:** hochgeladene Quell-PDFs in Supabase Storage.
- **Datenmenge:** erwartet Hunderte bis niedrige Tausende Einträge — Suche/Filter
  müssen dabei flott bleiben.
- **KI-Extraktion:** konkretes Modell/Verfahren wird in `/architecture` festgelegt.

## Open Questions
<!-- Ungelöste Punkte aus dem Interview. In /refine schließen, wenn geklärt. -->
- [ ] **Urheberrecht:** Speicherung wörtlicher Originaltext-Auszüge (aus Leitz-Lexikon
  & Hersteller-Katalogen) intern rechtlich absichern — ggf. mit Anwalt klären. (Fakten
  selbst sind frei; wörtliche Auszüge sind geschützt.)
- [ ] **Duplikat-Strategie:** getrennt lassen vs. automatisch zusammenführen, wenn
  derselbe Begriff aus mehreren Herstellern kommt.
- [ ] **Feldkatalog „technische Kennwerte":** feste Felder oder frei/variabel je
  Werkzeugart (z.B. Vorschub, Drehzahl, Schnittgeschwindigkeit, Zähnezahl, Winkel)?
- [ ] **Welche KI/Extraktions-Pipeline** (Modell, Kosten, on-prem vs. API) — Architektur.
- [ ] Taxonomie fix oder admin-erweiterbar — im Interview „admin-erweiterbar"
  empfohlen; final in Architektur/Umsetzung bestätigen.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Rolle „Redaktion" (statt nur Admin) | Dediziertes Content-/Wissens-Team, getrennt von der Werkstatt; erweitert PROJ-1 | 2026-07-20 |
| Ingestion: PDF-Upload → KI-Extraktion → Admin-Review | Wenig Tipparbeit bei vielen Themen, Kontrolle bleibt beim Menschen | 2026-07-20 |
| Eintrag = Lexikon-Begriff mit strukturierten Technik-Feldern | Ideale, gut abfragbare Grundlage für spätere Themen-/Artikelgenerierung | 2026-07-20 |
| Status Entwurf → Geprüft, nur „Geprüft" zählt als verlässlich | Qualitätskontrolle für KI-Extrakte, verhindert ungeprüfte Fakten | 2026-07-20 |
| Speicherung: destillierte Fakten UND wörtliche Originaltext-Auszüge | Bequeme Referenz für KI & Faktencheck; Urheberrecht bleibt offener Punkt | 2026-07-20 |
| Wissensbasis unabhängig von PROJ-28-Produkten (keine Zwangs-Verknüpfung) | Allgemeines Fachwissen, nicht an einzelne SKUs gebunden | 2026-07-20 |
| Taxonomie: Werkzeugart (Säge/Fräser/Bohrer) × Material (Holz/Kunststoff/Alu), admin-erweiterbar | Klarer Scope laut PM, aber ausbaubar | 2026-07-20 |
| Rein internes Tool, keine öffentliche Ansicht in dieser Spec | Öffentliche Ausspielung ist PROJ-32 | 2026-07-20 |
| Startzustand: initial nur Leitz-Lexikon, jederzeit um weitere Hersteller erweiterbar | Fundament wächst über die Zeit, kein Big-Bang-Import nötig | 2026-07-20 |

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
