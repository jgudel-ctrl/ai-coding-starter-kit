# Kunden-Stammdaten — Requirements Engineering Analyse

**Projekt:** TMS 2.0  
**Feature:** PROJ-2a.1 — Kunden-Verwaltung  
**Analyst:** Klausi (KI-Entwickler)  
**Datum:** 2026-07-02  
**Status:** Datenbank deployed, Daten leer — bereit für Befüllung

---

## 1. IST-Zustand der Datenbank

### Tabelle: `public.kunden`

| Feld | Typ | Constraints | Beschreibung |
|------|-----|-------------|--------------|
| `id` | UUID | PRIMARY KEY, auto | Eindeutige Identifikation |
| `firmenname` | TEXT | NOT NULL | Firmenname (Pflichtfeld) |
| `ansprechpartner_name` | TEXT | optional | Name Ansprechpartner |
| `ansprechpartner_telefon` | TEXT | optional | Telefonnummer |
| `ansprechpartner_email` | TEXT | optional | E-Mail-Adresse |
| `rechnungsadresse_strasse` | TEXT | optional | Straße + Hausnummer |
| `rechnungsadresse_plz` | TEXT | optional | Postleitzahl |
| `rechnungsadresse_ort` | TEXT | optional | Ort |
| `lieferadresse_strasse` | TEXT | optional | Abweichende Lieferadresse |
| `lieferadresse_plz` | TEXT | optional | Liefer-PLZ |
| `lieferadresse_ort` | TEXT | optional | Liefer-Ort |
| `notizen` | TEXT | optional | Freitext-Notizen |
| `status` | TEXT | DEFAULT 'aktiv', CHECK aktiv/inaktiv | Aktivitätsstatus |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Letzte Änderung |
| `created_by` | UUID → profiles.id | optional | Wer hat angelegt |
| `updated_by` | UUID → profiles.id | optional | Wer hat zuletzt geändert |

### Tabelle: `public.kunden_history` (Audit-Trail)

| Feld | Typ | Beschreibung |
|------|-----|--------------|
| `id` | UUID | Primärschlüssel |
| `kunde_id` | UUID → kunden.id | Referenz zum Kunden |
| `feld` | TEXT | Welches Feld wurde geändert |
| `alter_wert` | TEXT | Vorheriger Wert |
| `neuer_wert` | TEXT | Neuer Wert |
| `geaendert_von` | UUID → profiles.id | Wer hat geändert |
| `geaendert_am` | TIMESTAMPTZ | Wann wurde geändert |

---

## 2. Geschäftsregeln (Business Rules)

### BR-001: Kunden-Anlage
- Nur Benutzer mit Rolle **Admin** oder **Arbeitsvorbereitung** dürfen Kunden anlegen.
- **Firmenname ist Pflichtfeld.** Alle anderen Felder optional.
- Beim Anlegen wird automatisch `created_by` und `updated_by` auf den aktuellen Benutzer gesetzt.

### BR-002: Kunden-Bearbeitung
- Nur Admin/AV dürfen Kunden bearbeiten.
- Bei jeder Änderung wird automatisch ein Eintrag in `kunden_history` geschrieben.
- `updated_at` wird automatisch aktualisiert.

### BR-003: Kunden-Löschung (Soft-Delete)
- **Nur Admin** darf Kunden als "inaktiv" markieren.
- Kunden werden nie physisch gelöscht (Referenzintegrität für historische Aufträge).
- Inaktive Kunden werden in der Standardansicht ausgeblendet.

### BR-004: Kunden-Suche
- Jeder angemeldete Benutzer darf Kunden suchen und ansehen.
- Suche über Firmenname und Ansprechpartner-Name (case-insensitive).
- Filter nach Status: "Aktive", "Inaktive", "Alle".

### BR-005: Adressen
- Lieferadresse ist optional.
- Wenn Lieferadresse leer = Rechnungsadresse ist auch Lieferadresse.
- PLZ sollte numerisch sein (Validierung auf Frontend-Ebene empfohlen).

---

## 3. Rollen & Berechtigungen (RLS)

| Aktion | Admin | Arbeitsvorbereitung | QS | Werker | Fahrer |
|--------|-------|---------------------|-----|--------|--------|
| Kunden ansehen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kunden anlegen | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kunden bearbeiten | ✅ | ✅ | ❌ | ❌ | ❌ |
| Kunden inaktiv setzen | ✅ | ❌ | ❌ | ❌ | ❌ |
| History ansehen | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Offene Fragen / Empfehlungen

### ❓ Offene Fragen an Jan Bernd:

1. **Kundennummer:** Soll es eine automatische Kundennummer geben (z.B. K-00001)? Derzeit nur UUID.

2. **Mehrere Ansprechpartner:** Soll ein Kunde mehrere Ansprechpartner haben können? Derzeit nur einer.

3. **Branche/Kategorie:** Soll es ein Feld "Branche" oder "Kundenkategorie" geben?

4. **USt-IdNr.:** Brauchen wir die Umsatzsteuer-ID für Rechnungen?

5. **E-Mail-Validierung:** Soll die E-Mail-Adresse auf Eindeutigkeit geprüft werden?

### ✅ Empfohlene Erweiterungen (nicht kritisch):

- `kundennummer` — Menschenlesbare Nummer für den täglichen Betrieb
- `ust_id` — USt-IdNr. für Rechnungsstellung
- `branche` — Branchenzuordnung für Statistik
- `webseite` — Optionale Webseite des Kunden

---

## 5. Nächste Schritte

1. **Entscheidung:** Soll ich Testdaten in die Datenbank einfügen?
2. **Validierung:** Jan Bernd testet die Oberfläche live.
3. **Feedback:** Änderungswünsche sammeln.
4. **Erweiterung:** Optionale Felder (Kundennummer, etc.) hinzufügen falls gewünscht.

---

*Diese Analyse dient als Grundlage für die weitere Entwicklung. Bei Fragen oder Änderungswünschen bitte Rückmeldung.*
