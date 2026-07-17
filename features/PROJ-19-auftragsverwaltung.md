# PROJ-19 — Tourenverwaltung (ehemals "Auftragsverwaltung")

**Status:** ✅ Deployed  
**Erstellt:** 2026-07-04  
**Umbenannt:** 2026-07-06 (`tms.orders` → `tms.tours`)  
**Zielversion:** MVP  
**Unteraufgaben:** Mehrere (Tabelle → UI → Workflow)

---

## Zusammenfassung

Neues Feature "Tourenverwaltung" für TMS 2.0. Eine Tour ist ein konkreter Fahrer-Auftrag bei einem Kunden (z.B. "Sägeblätter abholen", "Werkzeuge überprüfen"). Jede Tour ist immer mit einem Kunden verknüpft und übernimmt beim Anlegen die Auftrags-Defaults des jeweiligen Kunden (Zugang, Rücksendung, Fahrer, Abholzyklus, Abholstatus).

> **Hinweis:** Die Tabelle hieß ursprünglich `orders` (Aufträge), wurde aber am 2026-07-06 in `tours` umbenannt, weil der Inhalt (Fahrer, Abholdatum, Abholservice) tatsächlich Touren darstellt — nicht Bestellungen.

---

## Nutzer-Stories

**Als** Mitarbeiter im Wareneingang / QS / Warenausgang  
**möchte ich** Touren anlegen können  
**damit ich** den Arbeitsfluss für Kunden-Aufträge digital abbilden kann.

**Als** Mitarbeiter  
**möchte ich** dass beim Anlegen einer Tour automatisch die Kunden-Voreinstellungen übernommen werden  
**damit ich** nicht jedes Mal die gleichen Daten (Zugang, Fahrer etc.) neu eingeben muss.

---

## Akzeptanzkriterien

### Teil 1: Datenbank-Tabelle (MVP)

1. **Tabelle `tours`** (ehemals `orders`) in Supabase existiert
2. **Verknüpfung zu `partners`**: Jede Tour hat einen `partner_id` (Pflichtfeld)
3. **Automatische Übernahme der Auftrags-Defaults**: Beim Anlegen einer Tour werden die Werte aus `partner_order_defaults` des jeweiligen Kunden übernommen:
   - `zugang` (Zugang zur Werkstatt)
   - `ruecksendung` (Rücksendung an Kunden)
   - `fahrer_id` (Fahrer für Abholung)
   - `abholzyklus_wochen` (Abholung alle X Wochen)
   - `abholservice` (Ja/Nein)
4. **Status-Workflow**: Tour hat einen Status (z.B. "Offen", "In Bearbeitung", "Abgeschlossen")
5. **Metadaten**: Anlege-Datum, letzte Änderung, erstellt von

### Teil 2+ (kommen später)

- UI zum Anlegen/Bearbeiten von Touren
- Tour-Übersichtsliste
- Workflow-Integration (Wareneingang → QS → Warenausgang)
- CSV-Import (Basis-Daten von Jan Bernd)

---

## Datenbank-Schema (Aktueller Stand: `tms.tours`)

### Tabelle: `tours`

| Feld | Typ | Beschreibung | Nullable |
|------|-----|--------------|----------|
| `id` | uuid | Primärschlüssel | Nein |
| `partner_id` | uuid | Verweis auf Kunden | Nein |
| `auftragsnummer` | text | Eindeutige Auftragsnummer (optional) | Ja |
| `titel` | text | Kurztitel der Tour | Ja |
| `beschreibung` | text | Details zur Tour | Ja |
| `status` | enum | Status: `geplant`, `abgeholt`, `in_bearbeitung`, `abgeschlossen`, `archiviert` | Nein (Default: `geplant`) |
| `zugang` | enum | Übernommen aus Kunden-Defaults | Nein |
| `ruecksendung` | enum | Übernommen aus Kunden-Defaults | Nein |
| `fahrer_id` | uuid | Übernommen aus Kunden-Defaults | Ja |
| `abholzyklus_wochen` | int | Übernommen aus Kunden-Defaults | Ja |
| `abholservice` | boolean | Übernommen aus Kunden-Defaults | Nein (Default: false) |
| `geplantes_abholdatum` | date | Wann soll der Fahrer vorbeikommen? | Ja |
| `tatsaechliches_abholdatum` | date | Wann wurde tatsächlich abgeholt? | Ja |
| `erstellt_am` | timestamptz | Automatisch | Nein |
| `geaendert_am` | timestamptz | Automatisch | Nein |
| `erstellt_von` | uuid | User-ID | Nein |

### Status-Mapping (CSV → Tabelle)

| CSV-Status | Datenbank-Status | Bedeutung |
|------------|------------------|-----------|
| `Werkzeuge abholen` | `geplant` | Fahrer soll noch vorbeikommen |
| `Wareneingang` | `abgeholt` | Schon abgeholt, im Wareneingang |
| `Archiv` | `archiviert` | Alter Auftrag, abgeschlossen |

### Fremdschlüssel

- `partner_id` → `partners.id` (ON DELETE RESTRICT)
- `fahrer_id` → `users.id` (optional, ON DELETE SET NULL)

### Indizes

- `partner_id` (für schnelle Suche nach Kunden)
- `status` (für Filterung)
- `geplantes_abholdatum` (für Fahrer-Planung / Zeitplan)
- `auftragsnummer` (eindeutig wenn vorhanden)

---

## CSV-Analyse (2026-07-05)

**Datei:** Excel (.xlsx) mit **3.622 Datensätzen**

| Status | Anzahl | Bedeutung |
|--------|--------|-----------|
| **Wareneingang** | 2.454 (~68%) | Bereits abgeholt, im Wareneingang |
| **Archiv** | 1.057 (~29%) | Alte, abgeschlossene Touren |
| **Werkzeuge abholen** | 111 (~3%) | Noch offen, Fahrer muss vorbeikommen |

**Datumsbereich:** 2025-03-27 bis 2026-10-22

### Mapping
- Kundennummern in CSV → `partners.easybill_customer_number`
- Auftrags-Defaults → `partner_order_defaults` (Zugang, Rücksendung, Fahrer, Abholzyklus)

### Status-Mapping (CSV → Datenbank)

| CSV-Status | Datenbank-Status | Abholdatum-Feld |
|------------|------------------|-----------------|
| `Werkzeuge abholen` | `geplant` | `geplantes_abholdatum` |
| `Wareneingang` | `abgeholt` | `tatsaechliches_abholdatum` |
| `Archiv` | `archiviert` | `tatsaechliches_abholdatum` |

### Import-Ergebnis

| | Anzahl |
|---|---|
| **Gelesen** | 3.606 |
| **Importiert** | **3.603** |
| **Nicht importiert** | 3 (Kundennummern nicht in DB) |

**Verteilung nach Import:**
- `abgeholt`: 2.451
- `archiviert`: 1.042
- `geplant`: 110

**Nicht importierte Kundennummern:** (leere Zeilen)

---

## Technische Hinweise

### Bestehende Tabellen (zur Referenz)
- `partners` — Kundenstamm
- `partner_default_values` — Auftrags-Defaults pro Kunde (PROJ-17)
- `users` — Benutzer/Fahrer

### RLS (Row Level Security)
- Lesen: Alle eingeloggten User
- Schreiben: Admins + Mitarbeiter mit entsprechender Rolle
- Ein User sieht nur Touren, auf die er berechtigt ist (z.B. seine Fahrer-Runden)

### Trigger
1. **Auto-Auftragsnummer**: Beim Anlegen wird automatisch die nächste Nummer vergeben (`AUF-XXXXXX`)
2. **Auto-Timestamp**: `erstellt_am` und `geaendert_am` werden automatisch gesetzt
3. **Abholservice-Consistency**: `abholservice` ist nur `true` wenn auch `abholzyklus_wochen` vorhanden ist

### Auftragsnummern-System
- **Format:** `AUF-XXXXXX` (6-stellig, mit führenden Nullen)
- **Beispiele:** `AUF-000001`, `AUF-000002`, `AUF-003603`
- **Automatisch:** Der Datenbank-Trigger generiert die nächste Nummer automatisch beim Anlegen
- **Eindeutig:** Keine doppelten Nummern möglich
- **Hochgezählt:** Nächste neue Nummer = höchste bestehende + 1

---

## Änderungsverlauf

| Datum | Autor | Änderung |
|-------|-------|----------|
| 2026-07-05 | Klausi | Datenbank-Tabelle `orders` erstellt, CSV-Import erfolgreich (3.603 von 3.606 Datensätzen) |
| 2026-07-05 | Klausi | CSV-Analyse ergänzt, Schema mit Abholdatum-Feldern erweitert |
| 2026-07-06 | Klausi | Tabelle `orders` → `tours` umbenannt (passt besser zur Funktion: Touren/Abholungen, nicht Bestellungen) |
