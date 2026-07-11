# PROJ-28: Technische Architektur — Hersteller-Verwaltung & Artikel-Zuordnung

**Status:** Architected  
**Projekt:** TMS 2.0  
**Autor:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-11

---

## 1. Zusammenfassung

Hersteller werden als eigene Stammdaten-Tabelle (`tms.manufacturers`) modelliert und über einen Fremdschlüssel (`manufacturer_id`) mit Produkten verknüpft. Die Daten kommen aus dem Easybill-JSON-Feld `raw_easybill_payload->>'note'`. Der Import ist ein einmaliger Admin-Vorgang. Alle weiteren Zuordnungen passieren entweder automatisch (beim Easybill-Sync) oder manuell durch Admins.

---

## 2. Komponenten-Struktur (Visueller Baum)

```
Hersteller-Verwaltungsseite  (/verwaltung/hersteller)
+-- Page Header
|   +-- Titel "Hersteller"
|   +-- "Importieren" Button (Admin only)
|   +-- "Neuer Hersteller" Button
|
+-- Import-Modal (nur für Import)
|   +-- Bestätigungs-Dialog
|   +-- Fortschritts-Anzeige (während Import)
|   +-- Ergebnis-Anzeige (nach Import)
|
+-- Hersteller-Tabelle
|   +-- Tabellen-Kopf (Name, Artikel-Anzahl, Aktionen)
|   +-- Zeile pro Hersteller
|       +-- Name
|       +-- Anzahl verknüpfter Artikel
|       +-- Bearbeiten-Button → öffnet Edit-Modal
|       +-- Löschen-Button (nur bei 0 Artikel)
|
+-- Edit-Modal (Hersteller bearbeiten)
|   +-- Name-Input
|   +-- Notizen-Textarea
|   +-- Speichern / Abbrechen
|
+-- Create-Modal (Hersteller anlegen)
    +-- Name-Input
    +-- Notizen-Textarea
    +-- Speichern / Abbrechen

Artikel-Liste (bzw. minimale Artikel-Übersicht)
+-- Filter-Leiste
|   +-- Hersteller-Dropdown (alle Hersteller + "Ohne Hersteller")
|   +-- Suchfeld
|   +-- Filter zurücksetzen
|
+-- Artikel-Tabelle
|   +-- Zeile pro Artikel
|       +-- Artikelnummer
|       +-- Beschreibung
|       +-- Hersteller-Badge (oder "—" wenn leer)
|       +-- Hersteller-Dropdown (Admin: inline änderbar)
|
+-- Multi-Select-Bar (nur Admin)
    +-- "Hersteller zuweisen" Dropdown
    +-- Ausgewählte Artikel-Anzahl
```

---

## 3. Datenmodell (Konzeptionell)

### Neue Tabelle: `tms.manufacturers`

Jeder Hersteller ist ein Stammdatensatz mit:
- Eindeutiger ID
- Name (einmalig — kein Hersteller darf doppelt vorkommen)
- Optionale interne Notizen
- Zeitstempel für Erstellung und letzte Änderung

### Erweiterte Tabelle: `tms.products`

Produkte bekommen ein neues optionales Feld:
- Verweis auf einen Hersteller (kann leer sein)
- Wenn ein Hersteller gelöscht wird, bleibt das Produkt erhalten (Hersteller-Verweis wird auf leer gesetzt)

### Abgeleitete Daten (keine eigene Tabelle)

Die Anzahl der Artikel pro Hersteller wird zur Laufzeit gezählt (z.B. über einen Datenbank-Zähler oder eine einfache Abfrage). Keine separate "Artikel-Hersteller-Zuordnungs-Tabelle" nötig — die Verknüpfung liegt direkt im Produkt.

---

## 4. Technische Entscheidungen

| Entscheidung | Erklärung |
|-------------|-----------|
| **Eigene Tabelle vs. Text-Feld in Produkten** | Eigene Tabelle ermöglicht: (a) Artikel-Anzahl pro Hersteller, (b) spätere Erweiterungen (Kontaktdaten), (c) zentrale Verwaltung |
| **Fremdschlüssel nullable** | Nicht alle 7.315 Artikel haben sofort einen Hersteller. Schrittweise Zuordnung ohne Zwang. |
| **Import aus Easybill-JSON** | Die einzige verfügbare Hersteller-Quelle ist das `note`-Feld im Easybill-Payload. Keine externe API nötig. |
| **Server Actions statt API-Routes** | Alle Datenoperationen (Import, CRUD, Zuordnung) laufen über Server Actions — konsistent mit dem restlichen Projekt (siehe PROJ-17, PROJ-20). |
| **RLS: Admin-only für Schreibzugriff** | Hersteller sind Stammdaten. Nur Admins dürfen anlegen/bearbeiten/löschen. Mitarbeiter sehen nur. |
| **Keine separate Import-Tabelle** | Der Import ist ein einmaliger Vorgang. Ergebnis wird dem Admin angezeigt, nicht persistent gespeichert. |
| **ON DELETE SET NULL** | Wenn ein Hersteller gelöscht wird, verlieren die Produkte nur die Verknüpfung — sie werden nicht mitgelöscht. |

---

## 5. API-Design (Konzeptionell)

Alle Operationen laufen als Server Actions (keine separaten REST-API-Endpoints nötig):

| Operation | Wer | Beschreibung |
|-----------|-----|-------------|
| `importManufacturers()` | Admin | Extrahiert Hersteller aus Easybill-JSON, legt an, verknüpft Produkte. Gibt Ergebnis zurück. |
| `getManufacturers()` | Alle | Liste aller Hersteller (Name + Artikel-Anzahl). Für Dropdowns und Filter. |
| `createManufacturer(name, notes)` | Admin | Legt neuen Hersteller an. Prüft auf Eindeutigkeit. |
| `updateManufacturer(id, name, notes)` | Admin | Ändert Name/Notizen. Name muss weiterhin eindeutig sein. |
| `deleteManufacturer(id)` | Admin | Löscht nur wenn 0 Artikel verknüpft. Sonst Fehler. |
| `getProducts(filters)` | Alle | Artikel-Liste mit optionaler Hersteller-Filterung. |
| `updateProductManufacturer(productId, manufacturerId)` | Admin | Weist einem Artikel einen Hersteller zu (oder entfernt ihn). |
| `bulkUpdateProductManufacturers(productIds, manufacturerId)` | Admin | Weist mehreren Artikeln gleichzeitig einen Hersteller zu. |

---

## 6. UI-Komponenten (Wiederverwendung aus Projekt)

| Komponente | Quelle | Verwendung |
|-----------|--------|-----------|
| shadcn/ui `Table` | Installiert | Hersteller-Tabelle, Artikel-Tabelle |
| shadcn/ui `Dialog` / `Modal` | Installiert | Hersteller anlegen/bearbeiten, Import-Bestätigung |
| shadcn/ui `Button` | Installiert | Überall |
| shadcn/ui `Input` | Installiert | Hersteller-Name, Suche |
| shadcn/ui `Textarea` | Installiert | Hersteller-Notizen |
| shadcn/ui `Select` | Installiert | Hersteller-Dropdown (Filter, Zuordnung) |
| shadcn/ui `Badge` | Installiert | Hersteller-Name in Artikel-Liste |
| shadcn/ui `Checkbox` | Installiert | Multi-Select für Bulk-Zuordnung |
| shadcn/ui `Alert` | Installiert | Fehlermeldungen (z.B. doppelter Name) |
| shadcn/ui `Skeleton` | Installiert | Ladezustände |
| `createAdminClient()` | Bestehend | Supabase-Service-Role-Client für Admin-Operationen |
| `revalidatePath()` | Next.js | Cache-Invalidierung nach Änderungen |

**Neue Komponenten nötig:**
- `ManufacturerTable` — Hersteller-Verwaltungstabelle
- `ManufacturerModal` — Anlegen/Bearbeiten-Dialog
- `ManufacturerImportModal` — Import-Bestätigung + Ergebnis
- `ProductManufacturerBadge` — Hersteller-Anzeige in Artikel-Listen
- `ProductManufacturerFilter` — Hersteller-Filter-Dropdown
- `BulkManufacturerAssign` — Multi-Select + Zuweisung

---

## 7. Seiten-Routing

| Route | Beschreibung | Zugriff |
|-------|-------------|---------|
| `/verwaltung/hersteller` | Hersteller-Verwaltung (Liste, Import, CRUD) | Nur Admin |
| `/verwaltung/artikel` (oder `/werkzeuge`) | Artikel-Liste mit Hersteller-Anzeige + Filter | Alle eingeloggten Nutzer |

**Hinweis:** Die Artikel-Seite existiert noch nicht (PROJ-2 ist Roadmap). Für PROJ-28 wird eine minimale Artikel-Übersicht mitgebaut, falls nötig.

---

## 8. Performance-Überlegungen

| Aspekt | Lösung |
|--------|--------|
| 7.315 Produkte beim Import | Import läuft serverseitig in einer Transaktion (kein Timeout-Risiko) |
| Hersteller-Dropdown mit 25+ Einträgen | Server-seitiges Laden, gecachte Liste |
| Artikel-Filter nach Hersteller | Datenbank-Index auf `manufacturer_id` für schnelle Filterung |
| Artikel-Anzahl pro Hersteller | Datenbank-Zählung (keine Materialized View nötig bei 25 Herstellern) |

---

## 9. Sicherheit

| Aspekt | Lösung |
|--------|--------|
| Schreibzugriff (Import, CRUD, Zuordnung) | Nur Admin — geprüft via Server Action + RLS |
| Lesezugriff (Hersteller-Liste, Filter) | Alle eingeloggten Nutzer |
| Service-Role-Client | Für Admin-Operationen, umgeht RLS (wie bestehende Admin-Patterns) |
| SQL-Injection | Kein String-Concatenation in Queries — Supabase Query Builder |

---

## 10. Migration & Rollout

1. **DB-Migration** — Neue Tabelle `manufacturers` + Spalte `manufacturer_id` in `products`
2. **Initial-Import** — Admin klickt einmalig "Importieren" auf `/verwaltung/hersteller`
3. **Manuelle Nacharbeit** — Admin ordnet die ~32 Artikel ohne Hersteller zu
4. **Danach** — Hersteller ist in allen Artikel-Listen sichtbar und filterbar

---

## 11. Abhängigkeiten

| Feature | Status | Begründung |
|---------|--------|-----------|
| PROJ-1 (Auth & Rollen) | Deployed ✅ | Admin-Check |
| PROJ-2 (Werkzeug-Stammdaten) | Roadmap | Artikel-Liste (wird parallel/minimal mitgebaut) |
| shadcn/ui Select | Installiert | Für Hersteller-Dropdowns |
| shadcn/ui Dialog | Installiert | Für Modals |
| shadcn/ui Table | Installiert | Für Tabellen |

**Keine neuen NPM-Packages nötig.**

---

## 12. Offene Fragen

- [ ] Soll die Artikel-Anzahl pro Hersteller in der DB gecacht werden (z.B. Trigger) oder live gezählt?
- [ ] Soll der Import-Button nach dem ersten Import verschwinden oder immer verfügbar bleiben (für Re-Import)?
