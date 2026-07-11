# PROJ-28: Hersteller-Verwaltung & Artikel-Zuordnung

**Status:** Planned  
**Projekt:** TMS 2.0  
**Priorität:** P2 (Erweiterung — keine Blockade für andere Features)  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-11

---

## 1. Problem-Statement

**Was fehlt:** 7.315 Produkte in der TMS haben aktuell keinen verknüpften Hersteller. Der Hersteller-Name steckt nur als Textfeld (`note`) im JSON-Rohdaten-Payload von Easybill — nicht als echte Stammdaten-Verknüpfung. Das macht Suchen, Filtern und Auswertungen nach Hersteller unmöglich.

**Werkstatt-Vergleich:** Stell dir vor, du hast 7.000 Werkzeuge im Lager, aber kein Feld "Hersteller" auf dem Etikett. Wenn jemand fragt "Zeig mir alle Artikel von AKE", müsstest du 7.000 Etiketten einzeln lesen.

**Warum wichtig:**
- Filtern nach Hersteller in Artikel-Listen
- Hersteller-spezifische Auswertungen (z.B. "Wie viele Artikel von Titmann haben wir?")
- Basis für spätere Erweiterungen (Hersteller-Kontaktdaten, Bestellung direkt beim Hersteller)

---

## 2. Anforderungen

### 2.1 Hersteller-Stammdaten anlegen (Admin)
- Neuer Bereich `/verwaltung/hersteller` (nur Admin)
- Tabelle mit allen Herstellern (Name, Anzahl Artikel)
- Hersteller erstellen (Name, optional Notizen)
- Hersteller bearbeiten (Name ändern — Artikel bleiben verknüpft)
- Hersteller löschen — nur wenn **0 Artikel** verknüpft sind (Schutz)

### 2.2 Hersteller aus Easybill-Daten importieren (Admin)
- Einmaliger Import: Extrahiert alle eindeutigen Hersteller-Namen aus `tms.products.raw_easybill_payload->>'note'`
- Legt automatisch Hersteller-Datensätze an
- Verknüpft alle passenden Produkte mit dem neuen Hersteller
- Zeigt Ergebnis: "X Hersteller importiert, Y Artikel verknüpft, Z ohne Hersteller"

### 2.3 Hersteller manuell zuordnen (Admin)
- Auf Produktdetail-Seite: Hersteller-Dropdown (alle vorhandenen Hersteller)
- Produkt-Liste: Inline-Hersteller-Zuordnung (mehrere Artikel auf einmal)
- Artikel ohne Hersteller markieren (z.B. "Ohne Hersteller"-Filter)

### 2.4 Hersteller in der UI anzeigen (Alle Rollen)
- Artikel-Liste: Hersteller-Name als Badge/Label
- Artikel-Detail: Hersteller-Name prominent anzeigen
- Filter in Artikel-Suche: "Nur Artikel von Hersteller X"
- Sortierung nach Hersteller möglich

---

## 3. Datenmodell

### Neue Tabelle: `tms.manufacturers`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Eindeutige ID (Primärschlüssel) |
| `name` | TEXT | Hersteller-Name (z.B. "AKE", "Stehle", "Titmann") |
| `notes` | TEXT | Interne Notizen (optional) |
| `created_at` | TIMESTAMPTZ | Erstellt |
| `updated_at` | TIMESTAMPTZ | Zuletzt geändert |

**Constraints:**
- `name` UNIQUE (kein Hersteller doppelt)
- `name` NOT NULL

### Erweiterte Tabelle: `tms.products`

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `manufacturer_id` | UUID → FK `manufacturers(id)` | Verknüpfung zum Hersteller |

**Constraints:**
- `manufacturer_id` nullable (nicht jedes Produkt hat sofort einen Hersteller)
- FK mit `ON DELETE SET NULL` (wenn Hersteller gelöscht, bleibt Produkt erhalten)

---

## 4. User Stories

### US-1: Admin importiert Hersteller aus Easybill-Daten
> Als Admin möchte ich alle Hersteller aus den bestehenden Artikeldaten automatisch extrahieren, damit ich nicht 25+ Hersteller manuell anlegen muss.

**Akzeptanzkriterien:**
- [ ] Angenommen der Admin ist auf der Hersteller-Verwaltungsseite, wenn er "Importieren" klickt, dann werden alle eindeutigen Hersteller-Namen aus `raw_easybill_payload->>'note'` extrahiert
- [ ] Angenommen der Import läuft, wenn er fertig ist, dann zeigt das System: Anzahl importierter Hersteller, Anzahl verknüpfter Artikel, Anzahl Artikel ohne Hersteller
- [ ] Angenommen ein Hersteller-Name existiert schon, wenn der Import läuft, dann wird dieser übersprungen (kein Duplikat)

### US-2: Admin ordnet Artikel ohne Hersteller zu
> Als Admin möchte ich Artikel, die keinen Hersteller haben, schnell einem Hersteller zuordnen.

**Akzeptanzkriterien:**
- [ ] Angenommen der Admin ist in der Artikel-Liste, wenn er den Filter "Ohne Hersteller" aktiviert, dann sieht er nur Artikel ohne Hersteller-Verknüpfung
- [ ] Angenommen der Admin wählt einen Artikel aus, wenn er einen Hersteller aus dem Dropdown wählt, dann wird der Artikel sofort mit diesem Hersteller verknüpft
- [ ] Angenommen der Admin wählt mehrere Artikel aus, wenn er "Hersteller zuweisen" nutzt, dann werden alle ausgewählten Artikel dem gleichen Hersteller zugeordnet

### US-3: Admin verwaltet Hersteller-Stammdaten
> Als Admin möchte ich Hersteller anlegen, bearbeiten und löschen können.

**Akzeptanzkriterien:**
- [ ] Angenommen der Admin ist auf `/verwaltung/hersteller`, wenn er "Neuer Hersteller" klickt, dann öffnet sich ein Formular mit Name und Notizen
- [ ] Angenommen der Admin gibt einen Namen ein, der schon existiert, wenn er abschickt, dann wird eine Fehlermeldung angezeigt (Name muss eindeutig sein)
- [ ] Angenommen der Admin löscht einen Hersteller, wenn dieser Artikel hat, dann wird eine Warnung angezeigt und das Löschen verhindert
- [ ] Angenommen der Admin löscht einen Hersteller ohne Artikel, wenn er bestätigt, dann wird der Hersteller entfernt

### US-4: Mitarbeiter sieht Hersteller in Artikel-Listen
> Als Mitarbeiter möchte ich den Hersteller in der Artikel-Übersicht sehen, damit ich schnell erkenne, von wem ein Artikel ist.

**Akzeptanzkriterien:**
- [ ] Angenommen ein Mitarbeiter ist in der Artikel-Liste, wenn ein Artikel einen Hersteller hat, dann wird der Hersteller-Name als Badge angezeigt
- [ ] Angenommen ein Artikel hat keinen Hersteller, wenn er in der Liste angezeigt wird, dann ist das Hersteller-Feld leer oder mit "—" markiert
- [ ] Angenommen ein Mitarbeiter klickt auf einen Hersteller-Namen, wenn der Name klickbar ist, dann werden alle Artikel dieses Herstellers gefiltert

### US-5: Mitarbeiter filtert nach Hersteller
> Als Mitarbeiter möchte ich nach Hersteller filtern, um nur Artikel eines bestimmten Herstellers zu sehen.

**Akzeptanzkriterien:**
- [ ] Angenommen ein Mitarbeiter ist in der Artikel-Liste, wenn er einen Hersteller aus dem Filter-Dropdown wählt, dann werden nur Artikel dieses Herstellers angezeigt
- [ ] Angenommen der Filter ist aktiv, wenn der Mitarbeiter "Filter zurücksetzen" klickt, dann werden wieder alle Artikel angezeigt
- [ ] Angenommen ein Hersteller hat 0 Artikel, wenn der Filter angezeigt wird, dann erscheint dieser Hersteller trotzdem in der Liste (für zukünftige Zuordnungen)

---

## 5. Edge Cases & Fehlerfälle

### EC-1: Doppelter Hersteller-Name
- **Problem:** "Stehle" und "stehle" (Kleinschreibung) oder "Titmann" vs "Titman"
- **Lösung:** Normalisierung beim Import — Trim + Capitalize (erster Buchstabe groß, Rest klein). Keine automatische Zusammenführung — Admin muss manuell entscheiden.

### EC-2: Leerer Hersteller-Name in Easybill-Daten
- **Problem:** 32 Artikel haben `note` = NULL oder leer
- **Lösung:** Diese Artikel bekommen keinen Hersteller zugewiesen. Sie erscheinen unter "Ohne Hersteller" und müssen manuell zugeordnet werden.

### EC-3: Import läuft zweimal
- **Problem:** Admin klickt aus Versehen zweimal auf Import
- **Lösung:** Idempotenz — Import prüft auf existierende Hersteller (UNIQUE-Constraint). Bereits verknüpfte Artikel werden nicht doppelt verknüpft.

### EC-4: Hersteller wird gelöscht, aber hat noch Artikel
- **Problem:** Löschen würde Artikel-Referenzen zerstören
- **Lösung:** Löschen verhindert, wenn `COUNT(products WHERE manufacturer_id = X) > 0`. Admin muss erst Artikel um- oder abmelden.

### EC-5: Gleichzeitige Bearbeitung
- **Problem:** Zwei Admins bearbeiten denselben Hersteller
- **Lösung:** Kein optimistisches Locking nötig — Hersteller hat nur Name + Notizen. Letzter Schreibt gewinnt.

---

## 6. Out of Scope

| Feature | Grund | Referenz |
|---------|-------|----------|
| Hersteller-Kontaktdaten (Adresse, Telefon, Email) | Nicht gefragt, kann später ergänzt werden | PROJ-28.2 (zukünftig) |
| Hersteller-Logo / Bild | Nicht gefragt | — |
| Hersteller-spezifische Preislisten | Nicht Teil dieses Features | PROJ-2 (Werkzeug-Stammdaten) |
| Automatische Neuzuordnung bei Easybill-Änderung | Easybill-Sync ist separat | PROJ-XX (Easybill-Sync) |
| Bulk-Import via CSV | Hersteller kommen aus Easybill-Daten, CSV nicht nötig | — |
| Hersteller-Webseite / externe Links | Nicht gefragt | — |

---

## 7. Product Decisions

| Entscheidung | Begründung |
|-------------|-----------|
| Eigene Tabelle `manufacturers` statt nur Text-Feld | Ermöglicht spätere Erweiterungen (Kontaktdaten, Bestellungen). Artikel-Anzahl pro Hersteller zählbar. |
| `manufacturer_id` als FK (nullable) | Nicht alle 7.315 Artikel haben sofort einen Hersteller. Stufenweise Zuordnung möglich. |
| Import aus Easybill-JSON `note`-Feld | Das ist die einzige Quelle für Hersteller-Informationen aktuell. 25+ Hersteller manuell anlegen wäre fehleranfällig. |
| Name = UNIQUE | Verhindert doppelte Einträge (z.B. "Stehle" + "stehle"). |
| ON DELETE SET NULL | Produkt bleibt erhalten, auch wenn Hersteller gelöscht wird. Keine kaskadierenden Löschungen. |
| Nur Admin darf Hersteller verwalten | Hersteller sind Stammdaten — nur Admins ändern Stammdaten. Mitarbeiter sehen nur. |
| Kein Logo / Bild für Hersteller | Nicht angefragt, reduziert Scope. |

---

## 8. Open Questions

- [ ] Soll die Hersteller-Liste alphabetisch sortiert sein oder nach Artikel-Anzahl?
- [ ] Soll der Hersteller-Name in der Artikel-Liste als klickbarer Filter-Link dienen?
- [ ] Soll es eine "Unbekannt"-Hersteller geben für Artikel ohne Hersteller (statt NULL)?

---

## 9. Abhängigkeiten

| Feature | Status | Begründung |
|---------|--------|-----------|
| PROJ-1 (Auth & Rollen) | Deployed ✅ | Admin-Check für Hersteller-Verwaltung |
| PROJ-2 (Werkzeug-Stammdaten) | Roadmap | Artikel-Liste / Artikel-Detail-Seite |

**Hinweis:** PROJ-28 kann parallel zu PROJ-2 gebaut werden, solange eine einfache Artikel-Liste existiert. Wenn PROJ-2 noch nicht gebaut ist, reicht eine minimale Artikel-Liste mit Hersteller-Anzeige.

---

## 10. Success Metrics

- 100% der Artikel mit Hersteller-Name in `raw_easybill_payload->>'note'` sind nach Import verknüpft
- 0 doppelte Hersteller in der Datenbank
- Artikel-Filter nach Hersteller zeigt Ergebnis in < 1 Sekunde
