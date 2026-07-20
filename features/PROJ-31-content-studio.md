# PROJ-31: Content-Studio (Generierung + Redaktion + Lern-Loop)

## Status: Planned
**Created:** 2026-07-20
**Last Updated:** 2026-07-20

> Dritter Baustein des **Content-Epics** (PROJ-29 → PROJ-30 → **PROJ-31** → PROJ-32) und dessen
> Herzstück. Hier wird zu einem **freigegebenen Thema** (aus PROJ-30) mit KI ein Artikel-**Text**
> erzeugt (Bilder werden hochgeladen) und im **Human-in-the-Loop** so lange verfeinert, bis er
> passt. Aus den
> Korrekturen **lernt** das System, damit Texte mit der Zeit „auf Anhieb" sitzen.
>
> **Prototyp-Validierung (2026-07-20):** Tonalität anhand eines echten Beispieltextes des Users
> (Sägeblatt-Schärf-Anleitung) + der Leitz-Anwenderlexikon-PDF erprobt. Muster-Artikel „Warum
> werden Ihre Werkzeuge stumpf?" wurde vom User als tonal passend bestätigt. Diese Erkenntnisse
> sind unten eingearbeitet.

## Dependencies
- **PROJ-1 (Auth & Rollen)** — Rolle **„Redaktion"** (+ Admin).
- **PROJ-29 (Wissensbasis)** — liefert die geprüften **Fakten/Quelldaten** als Grundlage der
  Generierung.
- **PROJ-30 (Themenvorschläge)** — liefert die **freigegebenen Themen**; Content wird **nur** für
  freigegebene Themen erstellt.
- **Speist PROJ-32 (Publishing)** — freigegebene Artikel gehen dorthin zur Ausspielung.
- **Extern:** KI-Textgenerierung (konkrete Modelle/Anbieter → `/architecture`). **Keine
  KI-Bildgenerierung** — Bilder werden hochgeladen (siehe Kern-Mechanik).

## User Stories
- Als **Redakteur** möchte ich zu einem freigegebenen Thema per Klick einen ersten Artikel-Entwurf
  generieren lassen, damit ich nicht bei null anfange.
- Als **Redakteur** möchte ich die **Tonalität über Regler** einstellen (z.B. Fachtiefe, Länge,
  werblich↔sachlich), damit der Text zu unserem Stil passt.
- Als **Redakteur** möchte ich **fachliche Fehler in einem Freitextfeld richtigstellen**, damit der
  Text technisch korrekt neu erzeugt wird.
- Als **Redakteur** möchte ich, dass **jede Iteration gespeichert** wird und das System aus meinen
  **fachlichen Korrekturen lernt**, damit künftige Texte denselben Fehler nicht wiederholen.
- Als **Redakteur** möchte ich **Bilder hochladen** (Häkchen „selbst gemacht" **oder** mit
  **Quellenangabe** aus dem Internet) und dazu einen **KI-überarbeiteten Bildtext** bekommen, damit
  der Artikel korrekt bebildert und beschriftet ist.
- Als **Redakteur** möchte ich einen Artikel **final freigeben**, damit er zur Veröffentlichung
  (PROJ-32) bereitsteht.
- Als **Admin** möchte ich einen **Beispiel-Text als Tonalitäts-Anker** hinterlegen, damit alle
  Generierungen von Anfang an unseren Stil treffen.

## Kern-Mechanik (validiert)
1. **Tonalitäts-Anker:** Ein hinterlegter **Beispiel-Text** (vom Team selbst geschrieben) gibt den
   Grundstil vor und fließt in jede Generierung ein.
2. **Zwei strikt getrennte Feedback-Wege:**
   - **🎚️ Regler = Stil/Tonalität** (wie der Text *klingt*).
   - **✍️ Freitext = ausschließlich fachliche Richtigstellung** (kein „gefällt mir nicht"; nur:
     „das ist technisch falsch, richtig ist …").
3. **Iterativ:** Feedback → Text wird **neu erzeugt** → wiederholen, bis „ok".
4. **Iterations-Historie:** jede Version wird gespeichert (nichts geht verloren).
5. **Lern-Speicher:** fachliche Korrekturen (und Tonalitäts-Einstellungen) werden gespeichert und in
   künftige Generierungen eingespeist → Fehler werden nicht wiederholt, der Start-Text wird über die
   Zeit besser („auf Anhieb passend").
6. **Harte Regeln:** **„Sie"-Form** als Standard; **kein Hersteller/keine Marke** wird je genannt
   (immer neutral).

## Out of Scope
- **Themenfindung & -freigabe** → PROJ-30 (Content entsteht nur für bereits freigegebene Themen).
- **Veröffentlichung & kanalspezifische Ausspielung** (Blog/Social/Newsletter) → PROJ-32.
- **Pflege der Wissensbasis** (PDF-Upload, Extraktion, Prüfung) → PROJ-29.
- **Kanalspezifische Format-Varianten** (kurzer Social-Post vs. langer Blog-Artikel) → primär
  PROJ-32; hier entsteht zunächst der **Kern-Artikel** (siehe Open Questions).
- **KI-Bildgenerierung** und automatische Stockfoto-Beschaffung — Bilder werden ausschließlich
  hochgeladen (selbst gemacht oder mit Quellenangabe); die KI überarbeitet nur den Bildtext.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Zugang & Voraussetzung
- [ ] Angenommen ein Nutzer hat nicht die Rolle Redaktion/Admin, wenn er das Content-Studio öffnet,
  dann wird ihm der Zugriff verwehrt.
- [ ] Angenommen ein Thema ist NICHT freigegeben (PROJ-30), wenn ein Redakteur dazu Content erstellen
  will, dann ist das nicht möglich (nur freigegebene Themen erscheinen im Studio).

### Generierung
- [ ] Angenommen ein freigegebenes Thema liegt vor, wenn der Redakteur „Entwurf erzeugen" klickt,
  dann erstellt die KI aus den geprüften Wissensbasis-Fakten einen ersten Artikel-Text im
  hinterlegten Tonalitäts-Stil.
- [ ] Angenommen ein Text wird erzeugt, wenn er erscheint, dann ist er in **Sie-Form** verfasst und
  enthält **keinen Hersteller-/Markennamen**.
- [ ] Angenommen die Generierung schlägt fehl (z.B. KI nicht erreichbar), wenn der Redakteur sie
  auslöst, dann wird eine verständliche Fehlermeldung angezeigt und kein leerer/halber Artikel
  gespeichert.

### Tonalität (Regler)
- [ ] Angenommen ein Entwurf liegt vor, wenn der Redakteur einen Tonalitäts-Regler ändert und neu
  erzeugen lässt, dann ändert sich der Stil entsprechend, während die fachlichen Inhalte erhalten
  bleiben.

### Fachliche Korrektur (Freitext)
- [ ] Angenommen ein Entwurf enthält einen fachlichen Fehler, wenn der Redakteur im Freitextfeld die
  Richtigstellung einträgt und neu erzeugen lässt, dann wird der Text mit der korrekten Angabe neu
  erstellt.
- [ ] Angenommen eine fachliche Korrektur wurde vorgenommen, wenn später ein **neuer** Artikel zu
  einem verwandten Thema erzeugt wird, dann berücksichtigt die KI die frühere Korrektur und
  wiederholt den Fehler nicht.

### Iteration & Lernen
- [ ] Angenommen ein Redakteur erzeugt mehrere Versionen, wenn er iteriert, dann wird **jede
  Version gespeichert** und ist in einer Historie einsehbar.
- [ ] Angenommen fachliche Korrekturen und Tonalitäts-Einstellungen wurden gemacht, wenn sie
  gespeichert werden, dann landen sie im **Lern-Speicher** und verbessern künftige Generierungen.

### Bilder
- [ ] Angenommen ein Artikel wird bearbeitet, wenn der Redakteur ein Bild hochlädt, dann muss er
  entweder **„selbst gemacht"** markieren **oder** eine **Quellenangabe** eintragen — sonst
  erscheint eine Validierungsmeldung (Quelle ist Pflicht).
- [ ] Angenommen ein Bild wurde hochgeladen, wenn es zugeordnet ist, dann erstellt/überarbeitet die
  KI den **Bildtext** (Bildunterschrift/Alt-Text); das **Bild selbst wird nicht** von der KI erzeugt.

### Freigabe
- [ ] Angenommen ein Artikel passt, wenn der Redakteur ihn freigibt, dann erhält er den Status
  „Freigegeben" und steht für die Veröffentlichung (PROJ-32) bereit.
- [ ] Angenommen ein Artikel ist „Freigegeben", wenn danach eine Änderung nötig wird, dann kann er
  zurück in Bearbeitung genommen werden (nachvollziehbar in der Historie).

## Edge Cases
- **KI erfindet Fakten (Halluzination):** Generierung soll sich an geprüfte Wissensbasis-Einträge
  halten; erfundene/unbelegte Aussagen werden über die Fakten-Korrektur richtiggestellt und gelernt.
  (Ob Aussagen zwingend an Quellen gebunden werden müssen → Open Question.)
- **KI nennt versehentlich eine Marke:** muss verhindert/abgefangen werden (Neutralitäts-Regel ist
  hart; Durchsetzung → Open Question).
- **Widersprüchliche Korrekturen über die Zeit:** wenn eine neue Korrektur einer früheren
  widerspricht, gilt die neuere; Historie bleibt nachvollziehbar.
- **Endlose Iteration:** kein festes Limit, aber die Historie muss übersichtlich bleiben
  (z.B. Versionen nummeriert).
- **Thema wird nach Start zurückgezogen** (in PROJ-30 entzogen): begonnener Content bleibt als
  Entwurf erhalten, kann aber nicht freigegeben werden, solange das Thema nicht freigegeben ist.
- **Gleichzeitige Bearbeitung** durch zwei Redakteure: kein stiller Datenverlust; letzte Änderung
  gewinnt, aber nachvollziehbar.
- **Kein/zu wenig Wissensbasis-Material zum Thema:** Hinweis an den Redakteur statt „erfundener"
  Text.

## Technical Requirements (optional)
- **Security:** nur Rollen Redaktion + Admin (RLS). Internes Tool.
- **KI-Textgenerierung** (+ KI-Überarbeitung der Bildtexte): Modelle/Anbieter, Kosten, Datenschutz →
  `/architecture`. **Keine** Bildgenerierung.
- **Speicherung:** Artikel, alle Iterationen, Bilder (Supabase Storage) und Lern-Speicher persistent.
- **Nachvollziehbarkeit:** wer hat wann welche Version erzeugt/korrigiert/freigegeben.

## Open Questions
- [ ] **Regler-Dimensionen & Wertebereiche** final festlegen (Vorschlag: Fachtiefe, Länge/
  Ausführlichkeit, werblich↔sachlich, Lockerheit/Formalität; Sie-Form fix). → Design/Architektur.
- [ ] **Lern-Mechanik technisch:** wie werden Korrekturen thematisch zugeordnet und eingespeist
  (Few-shot-Beispiele/gesammeltes Faktenwissen vs. späteres Fine-Tuning)? → `/architecture`.
- [ ] **Ein globaler Beispiel-Text als Tonalitäts-Anker oder mehrere** (z.B. je Content-Typ)?
- [ ] **Quellen-/Halluzinations-Absicherung:** müssen generierte Aussagen an konkrete
  Wissensbasis-Einträge gebunden/belegbar sein?
- [ ] **Neutralitäts-Durchsetzung:** wie hart wird „keine Marke nennen" erzwungen (Blacklist,
  automatische Nachkontrolle)?
- [ ] **Kanal-Varianten:** entsteht hier nur der Kern-Artikel, und kanalspezifische Kurz-/
  Langfassungen kommen in PROJ-32 — oder generiert das Studio direkt Varianten?
- [x] **Bildgenerierung:** geklärt (2026-07-20) — **keine** KI-Bildgenerierung; Bilder werden
  hochgeladen (Häkchen „selbst gemacht" ✓ oder mit Quellenangabe), die KI überarbeitet nur den
  Bildtext.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Content wird **nur für freigegebene Themen** (aus PROJ-30) erstellt | Klarer Freigabe-Gate vor Aufwand; keine Arbeit an unerwünschten Themen | 2026-07-20 |
| **Strikte Trennung:** Regler = Tonalität, Freitext = **nur fachliche Korrektur** | Vom User klar so gewünscht; hält Stil- und Fakten-Feedback sauber getrennt | 2026-07-20 |
| **Tonalitäts-Anker** = hinterlegter Beispiel-Text des Teams | Im Prototyp validiert — traf den Zielstil auf Anhieb sehr gut | 2026-07-20 |
| **Jede Iteration wird gespeichert**; fachliche Korrekturen fließen in einen **Lern-Speicher** | Kern des „Mitlernens": Fehler werden nicht wiederholt, Texte passen mit der Zeit sofort | 2026-07-20 |
| **Sie-Form** als Standard, **keine Hersteller-/Markennennung** (immer neutral) | Ausdrückliche Vorgabe des Users | 2026-07-20 |
| **Bilder werden hochgeladen** (Häkchen „selbst gemacht" oder mit Quellenangabe); **keine KI-Bildgenerierung**; KI überarbeitet nur den Bildtext | Urheberrecht sauber (Quelle Pflicht), authentische eigene Fotos; KI-Bildgenerierung teuer/unnötig | 2026-07-20 (refine) |
| Umbenannt von „Artikel-Werkstatt" → **„Content-Studio"** | Klarerer, passenderer Name | 2026-07-20 |

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
