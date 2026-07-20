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
- [ ] **KI-Extraktions-Kosten/-Volumen:** wie viele und wie große PDFs pro Monat? (Beeinflusst
  Kosten der externen KI-API — geklärt: Claude.)
- [x] **Asynchrone Verarbeitung:** geklärt (2026-07-20) — Upload ist **selten (~5 PDFs/Jahr)**,
  daher reicht eine **einfache Verarbeitung mit Fortschrittsanzeige**; keine Warteschlange/
  Hintergrund-Job nötig.
- [x] **Bilder:** geklärt (2026-07-20) — Bilder gehören **nicht** in die Wissensbasis, sondern zu den
  Content-Pieces (PROJ-31/32). Die Wissensbasis bleibt eine reine Fakten-/Text-Sammlung.

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
| Neue Rolle „Redaktion" ins bestehende Rollen-System (erweitert PROJ-1) | Dediziertes Content-Team, saubere RLS; vom ganzen Content-Epic genutzt | 2026-07-20 |
| Ablage in Supabase: Einträge/Kategorien in DB (Schema `tms`), PDFs in Supabase Storage | Konsistent mit der App, RLS, keine neue Infrastruktur | 2026-07-20 |
| KI-Extraktion über externe KI-API (Claude), serverseitig + gekapselt/austauschbar | Beste PDF-Verarbeitung, geringe Betriebskosten; KI-Schlüssel bleibt serverseitig | 2026-07-20 |
| UI nach bestehendem Verwaltungs-Muster (shadcn-Tabelle/Dialoge/Badges, wie Hersteller-/Nutzer-Verwaltung) | Wiederverwendung bewährter Bausteine, kein Neubau | 2026-07-20 |
| Extraktion mit Fortschrittsanzeige, aber **ohne Warteschlange** | Upload ist selten (~5 PDFs/Jahr) — einfache Verarbeitung genügt | 2026-07-20 |
| **Keine Bilder** in der Wissensbasis (bleiben bei den Content-Pieces, PROJ-31/32) | Wissensbasis = reine Fakten-/Text-Sammlung, schlank und wiederverwertbar | 2026-07-20 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

**Werkstatt-Vergleich:** Die Wissensbasis ist wie ein gut sortierter Karteikasten in der
Werkstatt. Ihr werft ein Hersteller-Handbuch in einen „Lese-Automaten" (die KI), der die
wichtigen technischen Angaben auf einzelne Karteikarten überträgt. Jede Karte landet erst im
Fach „Entwurf". Ein Redakteur prüft sie und schiebt sie ins Fach „Geprüft" — nur diese Karten
gelten dann als verlässlich.

### A) Komponenten-Struktur (was auf dem Bildschirm entsteht)
```
Wissensbasis-Seite  (nur Rolle Redaktion/Admin)
├── Kopfzeile
│   ├── Button „Dokument hochladen"
│   └── Filter & Suche (Werkzeugart · Material · Status · Volltext)
├── Upload-Dialog
│   ├── PDF/Dokument auswählen
│   ├── Fortschritt „KI liest das Dokument …"
│   └── Ergebnis: „X Einträge als Entwurf erstellt"
├── Einträge-Tabelle
│   ├── Spalten: Titel · Werkzeugart · Material · Quelle · Status (Entwurf/Geprüft)
│   └── Zeile anklicken → Detail/Bearbeiten
├── Eintrag Detail/Bearbeiten
│   ├── Felder: Titel · Werkzeugart · Material · technische Kennwerte ·
│   │           Beschreibung (eigene Worte) · Originaltext-Auszug · Quelle (Hersteller+Seite)
│   ├── „Auf Geprüft setzen" (prüft Pflichtfelder)
│   └── Verwerfen/Löschen
├── Kategorien-Verwaltung (Admin): Werkzeugart- & Material-Listen pflegen
└── Leerzustand: „Erstes Dokument hochladen"
```
Die Oberfläche folgt dem **bewährten Verwaltungs-Muster** der App (wie Hersteller- und
Nutzer-Verwaltung) — dieselben Bausteine (Tabelle, Dialoge, Status-Badges), nichts wird neu erfunden.

### B) Datenmodell (in Alltagssprache)
- **Wissens-Eintrag:** Titel/Begriff · Werkzeugart · Material · mehrere technische Kennwerte
  (Name→Wert) · Beschreibungstext (destilliert) · Originaltext-Auszug · Quelle (Hersteller +
  Dokument + Seite) · Status (Entwurf/Geprüft) · wer/wann erstellt & geändert · Verweis auf das
  Quell-PDF.
- **Quell-Dokument:** die hochgeladene PDF-Datei selbst (Dateiname, wann, von wem).
- **Kategorien:** zwei pflegbare Listen — Werkzeugart (Säge/Fräser/Bohrer …) und Material
  (Holz/Kunststoff/Aluminium …).
- **Ablage:** Einträge & Kategorien in der bestehenden Datenbank (Supabase, Schema `tms`), die
  PDF-Dateien im Datei-Speicher (Supabase Storage). Zugriff nur für Redaktion/Admin.

### C) Tech-Entscheidungen (warum so)
- **Neue Rolle „Redaktion"** ins bestehende Rollen-System (erweitert PROJ-1) — ein dediziertes
  Content-Team, sauber von den Werkstatt-Rollen getrennt. Einmal jetzt richtig gemacht, nutzt das
  ganze Content-Epic sie.
- **Alles in Supabase** (wie der Rest der App): Datenbank für die Karteikarten, Datei-Speicher für
  die PDFs. Konsistent, abgesichert (RLS), keine neue Infrastruktur.
- **KI-Extraktion über eine externe KI-API (Claude)**, **serverseitig** ausgeführt: Der Upload
  landet zuerst im Datei-Speicher, dann liest die KI das PDF und liefert fertige Entwurfs-Einträge
  zurück. Der KI-Zugangsschlüssel bleibt dabei **immer auf dem Server** (nie im Browser). Der
  KI-Dienst wird **gekapselt/austauschbar** angebunden — später leicht wechselbar.
- **Extraktion läuft asynchron mit Fortschrittsanzeige:** große Handbücher dürfen etwas dauern,
  ohne die Oberfläche zu blockieren.
- **Datenschutz/Urheberrecht:** Beim Extrahieren wird das PDF kurz an den KI-Dienst geschickt
  (interne Nutzung) — bleibt als Klärungspunkt vermerkt (siehe Open Questions).

### D) Abhängigkeiten (neue Bausteine)
- **KI-Anbindung** (Anthropic-SDK für die Extraktion) — einziges wirklich neues Paket.
- **Datei-Speicher** (Supabase Storage) — bereits im Projekt, kein neues Paket.
- **Validierung** (Zod) und alle UI-Bausteine (shadcn/ui) — bereits vorhanden.

## Implementierungsnotizen — Frontend (2026-07-20)

- **Neue Rolle „redaktion"** in `src/lib/roles.ts` ergänzt (Label „Redaktion" + Helfer
  `isRedaktion` / `canManageContent`).
- **Seite** `src/app/(app)/verwaltung/wissensbasis/page.tsx` — Server-Komponente,
  rollen-geschützt über `canManageContent` (Redaktion/Admin).
- **Komponenten** unter `src/components/wissensbasis/`:
  `wissensbasis-admin-page` (Kopf, Filter/Suche, Tabelle, Leerzustand, Dialog-Steuerung),
  `wissensbasis-table` (Status-Badges Entwurf/Geprüft), `wissensbasis-entry-modal`
  (Detail/Bearbeiten inkl. „Auf Geprüft setzen" mit Pflichtfeld-Prüfung Werkzeugart+Material),
  `wissensbasis-upload-dialog` (PDF-Upload mit „KI liest …"-Fortschritt).
- **Server-Actions-Gerüst** `src/lib/actions/wissensbasis.ts` mit Typen + **Stubs (Demo-Daten)**
  fürs Frontend-Review. Die echte Umsetzung (Supabase-Tabellen, PDF in Storage, KI-Extraktion via
  Claude, RLS für „redaktion") folgt im **`/backend`-Schritt** (Mutationen liefern aktuell bewusst
  „Wird im Backend-Schritt umgesetzt").
- **Navigation:** Link „Wissensbasis" im Admin-Menü (`app-header.tsx`). *Offen:* Sichtbarkeit des
  Nav-Links auch für Rolle „redaktion" (aktuell Admin-Menü) — im Backend/Refine nachziehen.
- **Neuer globaler Baustein (Design-System 3.1):** `src/components/page-overview.tsx`
  (`PageOverview`) — kompakte KPI-/Chart-Übersicht (max. ~⅓ Höhe, leichtgewichtig, dezente
  CSS-Aufbau-Animation) am Kopf **jeder** Seite; Funktion beginnt direkt darunter, ohne Scrollen
  bedienbar. Auf der Wissensbasis: KPIs (Gesamt/Geprüft/Entwurf) + schlanker „Prüfstand"-Balken.
  *Bestehende Seiten werden nach und nach nachgezogen.*
- **Verifiziert:** `tsc --noEmit`, Lint und `npm run build` laufen fehlerfrei; Route
  `/verwaltung/wissensbasis` kompiliert.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
