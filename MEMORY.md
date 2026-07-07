# MEMORY.md - Langzeitgedächtnis

## Jan Bernd Gudel (User)

- **Rolle:** Produktmanager / Product Owner
- **Fachgebiet:** Werkstatt-/Lagerumgebung (Maschinen, Werkzeuge, Lagerlogistik, Abläufe in Wareneingang/Warenausgang/QS)
- **Sprache:** Deutsch
- **Timezone:** Europe/Berlin

### Kommunikationsregeln

1. **Alltagssprache statt IT-Fachbegriffe** — Keine Begriffe wie "Migration", "Endpoint", "Race Condition" etc. ohne kurze Erklärung in Klammern (z.B. "Datenbank-Migration (Umzug der Daten in ein neues Format)")
2. **Vergleiche aus der Werkstatt-/Lagerwelt** — Technische Konzepte mit praktischen Beispielen aus dem Arbeitsalltag erklären (z.B. statt "API-Endpoint" → "wie ein Regalplatz, an dem Anfragen abgeholt werden")
3. **Entscheidungen = Nutzer-Auswirkung** — Bei "Soll ich X oder Y bauen?" die praktische Auswirkung für die Nutzer (Werker, QS, Fahrer etc.) erklären, nicht die technische Implementierung
4. **Status-Updates = Bedeutung in einem Satz** — Nicht nur den technischen Stand, sondern was es für Jan Bernd/die App bedeutet (z.B. "Die Änderung bedeutet: Der QS-Mitarbeiter spart pro Prüfung 2 Klicks.")
5. **Fachliche Entscheidungen: fragen. Technische Entscheidungen: selbst treffen und kurz informieren.** — Produkt-Fragen kommen zu Jan Bernd, reine Technik-Entscheidungen trifft Klausi selbst

## Klausi (Ich)

- **Name:** Klausi
- **Emoji:** 🛠️
- **Rolle:** KI-Entwickler auf Jan Bernds Hetzner-Server
- **Vibe:** Pragmatisch, direkt, hilfsbereit ohne Geschwätz. Entwickler-Mentalität: erst nachschauen, dann fragen.

### Arbeitsregeln (von Jan Bernd)

- **Erst prüfen, dann fragen.** Logs/Code/Kontext anschauen, bevor ich nachfrage.
- **Keine Änderungen ohne Freigabe.** Analysieren, vorschlagen, erklären — aber nichts am System/Code/Config ändern, deployen oder ausführen, das Wirkung hat, ohne dass Jan Bernd ausdrücklich grünes Licht gibt. Lesen/Erkunden ist frei, Schreiben/Verändern braucht OK.

## Telegram-Bot

- **Username:** @janni_botti_bot
- **Name:** KlausI
- **ID:** 8789190677
- **Channel:** `channels.telegram` in openclaw.json
- **Einstellung:** `requireMention: true` in Gruppen (nur auf @-Erwähnung reagieren)
- **Token-Setup:** Erfolgt am 2026-06-18. Token via sicherem Schreibweg eingetragen.

## Workflow-Regeln (festgelegt 2026-06-30)

Für jedes neue Feature gilt verbindlich:
```
/init → /write-spec → User-Review ("approved") →
/architecture → User-Review ("approved") →
/frontend → /backend → /qa → /deploy
```

- Nach `/write-spec` und nach `/architecture` **IMMER** auf explizites "approved" vom User warten.
- Ausnahme: **Trivialer Hotfix** (z.B. Einzeiler, ENV-Variable) — **NUR** wenn Jan Bernd das Wort "Hotfix" explizit verwendet. Dann darf der volle Workflow übersprungen werden, aber Spec/INDEX muss danach trotzdem aktualisiert werden.
- Vor jeder Code-Änderung: CLAUDE.md, docs/PRD.md und relevante Datei in features/ lesen.
- Status in features/INDEX.md und Feature-Header immer synchron halten.
- Dokumentiert in: CLAUDE.md (Abschnitt "Pflicht-Workflow") und `.claude/rules/workflow.md`

## PROJ-22 Abholungskalender (Admin)

- **Status:** Deployed ✅ (2026-07-07)
- **Features:**
  1. Kalender-Ansicht für blockierte Tage (Feiertage, Wochenende, manuelle Blocker)
  2. Monats-, Wochen-, Jahres-Ansicht
  3. Blocker-Verwaltung direkt im Kalender (click → popup → löschen/erstellen)
  4. Feiertage auto-initialisiert (NRW, 12 Monate im Voraus)
  5. Monatlicher Cron-Job für Feiertag-Updates
  6. Wochenende visuell markiert (grau, "WE")
- **Tech-Learnings:**
  - `force-dynamic` + `revalidate = 0` notwendig für Daten, die sich ändern
  - Server Actions mit Anon-Client + RLS schlagen fehl bei SSR (keine Cookies) → Service-Role-Client verwenden für Admin-Seiten
  - `parseLocalDate()` für korrekte Datum-Vergleiche (kein UTC-Shift)
- **Spec:** features/PROJ-22-kalender-blockierte-tage.md
- **Architektur:** features/PROJ-22-architektur.md

## PROJ-21 Fahrer-Seite

- **Status:** Deployed ✅ (2026-07-06)
- **Features:**
  1. Route `/fahrer` mit Listenansicht (heutige Abholungen) + Kartenansicht
  2. Tabs: "Heute" und "Nächste 5 Tage"
  3. Kalender-Ansicht: Gruppiert nach Datum mit Tages-Header
  4. "Abgeholt"-Button setzt Status auf `erledigt`, Tour verschwindet aus Liste
  5. Navigation zu Google Maps pro Kunde
  6. Leer-Zustand wenn keine Abholungen
  7. Mobile-first Design für Fahrer unterwegs
- **Tech:** Leaflet (OpenStreetMap), Server Actions, revalidatePath
- **Spec:** features/PROJ-21-fahrer-seite.md
- **Architektur:** features/PROJ-21-architektur.md

## PROJ-20 Logistik & Abholung

- **Status:** Deployed ✅ (2026-07-06)
- **Features:**
  1. Neue Seite `/verwaltung/abholung` für Logistik-Planung
  2. Kalender-Ansicht mit Monats-/Wochen-Ansicht
  3. Drag & Drop zum Verschieben von Abhol-Terminen
  4. Status: geplant, in_bearbeitung, abgeholt, abgeschlossen
  5. Touren-Gruppierung nach Datum
  6. Fahrer-Zuweisung pro Tour
  7. Blockierte Tage (z.B. Feiertage) markierbar
- **Tech:** date-fns, react-big-calendar, @dnd-kit
- **Spec:** features/PROJ-20-logistik-abholung.md

## PROJ-19 Tourenverwaltung (ehemals "Auftragsverwaltung")

- **Status:** Deployed ✅ (2026-07-05) | **Umbenannt:** 2026-07-06 (`tms.orders` → `tms.tours`)
- **Features:**
  1. Tabelle `tms.tours` erstellt (16 Spalten, Auftragsnummern auto-generiert `AUF-XXXXXX`)
  2. 3.603 von 3.606 historische Touren importiert (3 mit leeren Kundennummern übersprungen)
  3. Neue Kennzahl: "Schärfumsatz / Tour" (Durchschnitt pro Tour) im Umsatz-Tab
  4. Zeigt Tour-Anzahl als Subtext an (z.B. "47 Touren")
  5. Alle Umsatzberechnungen sind Netto (aus `invoice_items.total_net`)
  6. Kein Vorjahresvergleich (Vorperioden haben oft zu wenig Touren)
- **Tech:** Neue Action `order-stats.ts`, Server-seitige Berechnung
- **Spec:** features/PROJ-19-auftragsverwaltung.md
- **Architektur:** features/PROJ-19-architektur.md

## PROJ-17 Auftrags-Default im Kunden-Detail

- **Status:** Deployed ✅ (2026-07-03)
- **Features:**
  1. Neuer Tab "Auftrags-Default" auf Kundendetailseite (4. Tab)
  2. Zeigt: Zugang, Rücksendung, Fahrer, Abholzyklus (Wochen), Abholstatus
  3. Bearbeiten nur für Admins (Stift-Icon)
  4. Fahrer-Dropdown aus Usern mit Rolle "fahrer"
  5. Validierung: Fahrer Pflicht bei Abholservice oder "Bringen"
- **Tech-Learning:** shadcn Select (Radix Portal) verursachte Hydration-Fehler → native HTML-Elemente verwendet
- **Spec:** features/PROJ-17-auftrags-default.md
- **Architektur:** features/PROJ-17-architektur.md

## PROJ-16 Gestapeltes AreaChart

- **Status:** Deployed ✅ (2026-07-02)
- **Features:**
  1. AreaChart ist gestapelt — Handelsware unten (grün), Service (orange), Sonderwerkzeug (lila)
  2. Gesamthöhe = Summe aller drei Kategorien (sichtbar als gestapelte Fläche)
  3. Jahresansicht zeigt auch gestapelte Kategorien statt nur blauem Gesamtstrich
  4. Vorherige 12M bleibt als gestrichelte Linie (nicht gestapelt)
- **Tech:** Recharts `stackId`, fillOpacity, keine Gradienten beim Stacking
- **Spec:** features/PROJ-16-stacked-area-chart.md
- **Architektur:** features/PROJ-16-architektur.md

## PROJ-15 Vorjahresvergleich + Jahres-/Monats-Ansicht

- **Status:** Deployed ✅ (2026-07-02)
- **Features:**
  1. KPI-Karten zeigen Rolling 12 Months + prozentuale Änderung zu den 12 Monaten davor (grün/rot)
  2. AreaChart (ausgefüllte Linien) statt Balken
  3. Gestrichelte Vorjahres-Linie im Chart (Vorherige 12 Monate)
  4. Toggle zwischen "12 Monate" und "Jahr"
  5. Jahresansicht zeigt Jahre auf X-Achse mit Gesamtumsatz pro Jahr
- **Tech:** Recharts AreaChart, linearGradient, parallel Data Fetching
- **Änderung 2026-07-02:** YTD ersetzt durch Rolling 12 Months (letzte 12 Monate statt Jan-Juli)
- **Spec:** features/PROJ-15-vorjahresvergleich.md
- **Architektur:** features/PROJ-15-architektur.md

## PROJ-14 Kundendetailseite — Umsätze fix + Service-Icon

- **Status:** Deployed ✅ (2026-07-02)
- **Bugs behoben:**
  1. Umsätze wurden nicht geladen (RLS blockierte Anon-Key auf Materialized View) → Fix: Service-Role-Client in `revenue.ts`
  2. Service-Icon war `Receipt` (Dollar-Zeichen) statt `Wrench` (Schraubenschlüssel) → Fix in `revenue-summary.tsx`
- **Spec:** features/PROJ-14-umsatz-service-icon-fix.md
- **Architektur:** features/PROJ-14-architektur.md

## PROJ-1 Auth & Rollen

- **Status:** Deployed ✅ (letzter Commit aeffdd4: Passwort-Reset-Link auf korrekte Live-Domain gefixt)
- **Spec-Header:** Letzter Stand "In Progress" → müsste auf "Deployed" aktualisiert werden

## PROJ-18 Globaler Header mit Navigation

- **Status:** Deployed ✅ (2026-07-03)
- **Features:**
  1. Neuer globaler Header mit ☰ Burger-Menü links, Logo zentriert, User-Menü rechts
  2. Navigation zu 7 Bereichen: Dashboard, Home, Kunden, Werkzeuge, Service, Verwaltung, Einstellungen
  3. Logo zentriert mit weißer Schrift
  4. Auf allen eingeloggten Seiten sichtbar
- **Fix:** Kunden-Route war außerhalb `(app)` → verschoben nach `(app)/kunden`
- **Spec:** features/PROJ-18-globaler-header.md
- **Architektur:** features/PROJ-18-architektur.md

## BUG-2 Bestellhistorie — Keine Daten (Permissions)

- **Status:** Deployed ✅ (2026-07-03)
- **Bugs behoben:**
  1. Bestellhistorie zeigte leere Liste — `invoice_items` und `invoices` hatten keine `service_role` Permissions → Fix: `GRANT ALL ON tms.invoice_items TO service_role;` und `GRANT ALL ON tms.invoices TO service_role;`
  2. Mobile-Ansicht zu breit → Fix: Kompakte Karten-Liste statt Tabelle, Klick öffnet Detail-Modal mit Swipe-Navigation (links/rechts für vorheriger/nächster Artikel)
- **Spec:** features/BUG-2-bestellhistorie-keine-daten.md
- **Architektur:** features/BUG-2-bestellhistorie-architektur.md

## PROJ-11 Kundendetailseite (erweitert)

- **Status:** Deployed ✅ (2026-07-02)
- **Features:** Tabs (Übersicht/Umsatz/Bestellhistorie), editierbare Adressen, Kontaktverwaltung, Umsatz-Balkendiagramm mit Jahres-Switch, Bestellhistorie (NUR Trade Goods)
- **Tech:** Framer Motion, Recharts, Bento Grid, Responsive
- **Spec:** features/PROJ-11-kundendetailseite.md
- **Architektur:** features/PROJ-11-architektur.md
- **QA-Bericht:** features/PROJ-11-qa-bericht.md

## Server-Setup

- **Host:** gudel-werkzeuge-tms (Hetzner)
- **Gateway:** Port 18789, systemd-user-service
- **Workspace:** /home/botti/.openclaw/workspace
- **Model:** ollama-cloud/kimi-k2.6 (default)
