# PROJ-20 · Logistik & Abholung im Kunden-Detail

**Status:** ✅ Deployed (Code seit 2026-07-06 auf `main`, Status-Header war fälschlich noch "Planned")  
**Scope:** Kundendetailseite — Tab erweitern + "Nächste Abholung"-Karte + Blocker-Verwaltung  
**Depends on:** PROJ-17 (Auftrags-Default), PROJ-19 (Touren-Tabelle `tms.tours`)  
**Tech-Stack:** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, Supabase (self-hosted)

---

## Bugfix 2026-07-16 — "Nächste Abholung" funktionierte nicht live

**Symptom:** "Abholung erstellen" auf der Kundendetailseite schlug fehl bzw. neue Abholungen
erschienen nicht in der "Nächste Abholung"-Karte.

**Root Causes in `src/lib/actions/pickup-tours.ts`:**
1. `createPickupTour()` und `autoCreateNextPickup()` speicherten `status: "geplan"` (Tippfehler,
   fehlendes "t"). Überall sonst im Code (Query-Filter, Status-Badge, Fahrer-Seite) wird
   `"geplant"` verwendet — der reale DB-Enum-Wert ist `"geplant"`. Der Insert mit dem
   ungültigen Enum-Wert schlug fehl.
2. `calculateNextPickupDate()`, `createPickupTour()` und `autoCreateNextPickup()` lasen die
   nicht existierenden Spalten `fahrer_id`, `zugang`, `ruecksendung`, `abholzyklus_wochen`,
   `abholservice` aus `tms.partner_order_defaults` — diese Spalten gehören zur `tms.tours`-Tabelle,
   nicht zu den Kunden-Defaults (siehe PROJ-17-Schema). Dadurch wurde der Fahrer nie automatisch
   aus den Kunden-Defaults vorbefüllt.
3. **Bonus-Fund (gleiche Ursache):** `src/lib/actions/order-stats.ts` filterte noch auf den
   alten Enum-Wert `"abgeholt"` statt `"erledigt"` (im Rahmen von PROJ-20 in der Live-DB
   umbenannt) — dadurch wurden ~70% der Touren-basierten Umsatzstatistik übersehen.

**Fix:** Enum-Wert auf `"geplant"` korrigiert, Spaltenabfragen auf die tatsächlichen
`partner_order_defaults`-Spalten (`driver_id`, `pickup_day`, `pickup_cycle_count`,
`pickup_delivery_status`) reduziert, `order-stats.ts` auf `"erledigt"` umgestellt.
`npm run build` erfolgreich (keine TS-Fehler).

## Problem Statement

Der aktuelle Tab "Auftrags-Default" auf der Kundendetailseite ist zu eng gefasst. Er zeigt nur statische Defaults (Zugang, Rücksendung, Fahrer), aber nicht den aktuellen operativen Status: **Wann kommt der Fahrer als Nächstes vorbei?** Für Fahrer, Admin und Arbeitsvorbereitung fehlt diese Echtzeit-Information direkt am Kunden.

Zusätzlich fehlt eine zentrale Stelle, um **Feiertage und Urlaubstage** zu verwalten — Tage, an denen keine Abholungen stattfinden dürfen. Heute passiert das manuell oder gar nicht.

---

## Ziel & Nutzen

- Der Tab "Logistik & Abholung" zeigt auf einen Blick den **nächsten geplanten Abholtermin** für einen Kunden.
- Ohne geplante Abholung kann ein Admin mit einem Klick eine neue Abholung anlegen — mit vorausgefüllten Werten aus den Kunden-Defaults.
- Wenn eine Abholung erledigt wird und der Kunde auf "Automatisch" steht, wird die nächste Abholung automatisch erstellt.
- **Blocker-Verwaltung** (Feiertage + Urlaub) zentral im Admin-Bereich pflegbar — keine Abholungen an diesen Tagen.

**Nutzer-Auswirkung:** Der Admin sieht sofort, ob ein Kunde "dran" ist oder noch nicht eingeplant wurde. Die Planung berücksichtigt automatisch Wochentage, Feiertage und Urlaub. Der QS- / Planungs-Mensch spart pro Kunde 2–3 Klicks.

---

## In Scope

### Teil A: Kundendetail — Tab erweitern

1. **Tab umbenennen:** "Auftrags-Default" → **"Logistik & Abholung"**
2. **Bestehendes Feld `pickup_day` in Logistik-Defaults integrieren:** Das Feld existiert bereits in `tms.partner_order_defaults` (Wochentag: Montag–Freitag), wird aber aktuell noch nicht in der UI angezeigt. Es muss in die Auftrags-Default-Karte und das Bearbeitungs-Formular aufgenommen werden. Nur relevant bei "Abholservice durch Gudel Werkzeuge".
3. **Bestehende Inhalte beibehalten:** Zugang, Rücksendung, Fahrer, Abholzyklus, Abholstatus bleiben erhalten.
4. **Neue Karte "Nächste Abholung":**
   - Liest aus `tms.tours` die nächste Tour mit `status = 'geplan'` für diesen Kunden.
   - Zeigt: Status, geplantes Abholdatum, Fahrer (Name), ggf. Notiz/Titel.
   - Status-Badge mit Farbe (🟡 geplan / 🟢 erledigt).
5. **Leer-Zustand:** Falls keine geplante Tour existiert:
   - Zeigt: "Keine Abholung geplant"
   - Button: **"+ Abholung erstellen"** (nur Admin, und nur wenn kein "Abholservice"-Default vorliegt → siehe Regeln).

### Teil B: Abholung erstellen (Modal)

6. **Button "+ Abholung erstellen"** sichtbar nur wenn:
   - **UND** Kunde hat in Defaults "Abholservice durch Gudel Werkzeuge" als Zugang
   - **UND** keine Tour mit `status = 'geplan'` für diesen Kunden existiert
   > Hinweis: Jeder eingeloggte User darf eine Abholung erstellen (kein Admin-Zwang).
7. **Modal-Felder:**
   - **Geplantes Abholdatum** (Date-Picker) — vorausgefüllt mit dem nächsten passenden Wochentag (siehe Datum-Berechnung)
   - **Fahrer** (Dropdown) — vorausgefüllt aus Default
   - **Titel / Notiz** (Textfeld, optional)
8. **Datum-Berechnung beim Erstellen:**
   - Start: Heute + Abholzyklus-Wochen (z. B. heute + 2 Wochen)
   - Dann: Auf den nächsten passenden **Abholtag** (Wochentag aus Defaults) korrigieren
   - Dann: Prüfen, ob dieser Tag ein **Feiertag NRW** oder **blockierter Tag** (Urlaub) ist
   - Falls ja: Nächsten freien Tag suchen (Schleife: +1 Tag, prüfen Wochentag + Feiertag + Blocker)
   - Ergebnis: Das Datum wird im Date-Picker vorausgefüllt, Admin kann es ändern
9. **Speichern in `tms.tours`** mit `status = 'geplan'`

### Teil C: Automatische Abholung nach "Erledigt"

10. **Wenn eine Tour auf `erledigt` gesetzt wird** (Status-Wechsel `geplan` → `erledigt`):
    - Prüfen: Hat der Kunde `abholservice = true` (Abholstatus = "Automatisch")?
    - Falls ja: Automatisch nächste Abholung erstellen mit:
      - Datum = heute + Abholzyklus-Wochen, korrigiert auf Abholtag, ohne Feiertage/Blocker
      - Fahrer, Zugang, Rücksendung aus Defaults kopiert
      - Status = `geplan`
    - Falls nein (Abholstatus = "Anruf"): Keine automatische Erstellung. Admin/User muss manuell eine neue Abholung erstellen.

### Teil D: Blocker-Verwaltung (Admin)

11. **Neue Tabelle `tms.blocked_days`:**
    - `id` UUID PK
    - `datum` DATE NOT NULL UNIQUE
    - `grund` TEXT (z. B. "Urlaub", "Feiertag", "Betriebsferien")
    - `erstellt_am` TIMESTAMPTZ DEFAULT now()
    - `erstellt_von` UUID REFERENCES auth.users(id)
12. **Neue Admin-Seite** `/verwaltung/blocker` (unter Verwaltung):
    - Kalender-Ansicht (Monats-View)
    - Feiertage NRW werden **automatisch berechnet** und als Blocker-Tage vorausgefüllt
    - **Admin kann ALLE Blocker-Tage bearbeiten und löschen** — sowohl automatische Feiertage als auch manuelle Einträge
    - Admin kann zusätzliche Tage als "Blocker" markieren (Urlaub, Betriebsferien, etc.)
    - Liste aller blockierten Tage mit Grund und Typ (Feiertag / manuell)
13. **Feiertage NRW** (automatisch berechnet, aber editierbar):
    - Neujahr (1.1), Karfreitag, Ostermontag, 1. Mai, Christi Himmelfahrt, Pfingstmontag, Fronleichnam, Tag der Deutschen Einheit (3.10), Allerheiligen (1.11), 1. Weihnachtstag, 2. Weihnachtstag
    - Dynamisch berechnet (Ostern = nach Gauß-Algorithmus)
    - Werden beim ersten Aufruf der Blocker-Verwaltung automatisch in `tms.blocked_days` eingetragen
    - Admin kann sie wie alle anderen Blocker-Tage löschen oder den Grund ändern

---

## Out of Scope

- Keine Kalender-Ansicht / Wochenplan für Touren (separater Feature-Request).
- Keine E-Mail-Benachrichtigungen beim Erstellen einer Tour.
- Keine Bearbeitung bestehender Touren in diesem Feature (nur Erstellen).
- Kein Löschen von Touren aus dem Kunden-Detail.
- Keine Drag-and-Drop Fahrer-Zuweisung.

---

## UI/UX

### Tab-Name & Icon

- Label: **"Logistik & Abholung"**
- Icon: `Truck` (Lucide)
- Mobile: **"Logistik"** (kurz).

### Layout des Tabs

```
┌─────────────────────────────────────────────┐
│  📋 Logistik-Defaults          [Stift]      │
│  Zugang:      Abholservice durch Gudel...     │
│  Rücksendung: Versenden                       │
│  Fahrer:      Max Mustermann                  │
│  Abholtag:    Donnerstag                      │
│  Abholzyklus: Alle 2 Wochen                   │
│  Abholstatus: Automatisch                     │
├─────────────────────────────────────────────┤
│  📅 Nächste Abholung                          │
│                                             │
│  Status:   🟡 Geplant                         │
│  Datum:    Do, 17.07.2026                     │
│  Fahrer:   Max Mustermann                     │
│  Notiz:    Regelmäßige Abholung               │
│                                             │
│  [Details ansehen]                            │
├─────────────────────────────────────────────┤
│  📅 Nächste Abholung   (LEER-ZUSTAND)         │
│                                             │
│  Keine Abholung geplant                       │
│                                             │
│  [+ Abholung erstellen]                       │
└─────────────────────────────────────────────┘
```

### Admin-Seite Blocker-Verwaltung

```
┌─────────────────────────────────────────────┐
│  🚫 Blocker-Verwaltung                        │
│                                             │
│  [Kalender: Juli 2026]                        │
│  • 03.07        Fronleichnam    (Feiertag)    │
│  • 14.07–25.07  Betriebsferien  [Löschen]     │
│  • 01.08        Sommerurlaub    [Löschen]     │
│  • 15.08–22.08  Urlaub          [Löschen]     │
│                                             │
│  [+ Zeitraum blockieren]                      │
│    Von: [Date-Picker]  Bis: [Date-Picker]     │
│    Grund: [Textfeld]                          │
└─────────────────────────────────────────────┘
```

---

## Datenmodell

### Änderung: `tms.partner_order_defaults` (bestehende Spalte `pickup_day` integrieren)

Die Spalte `pickup_day` existiert bereits in der Tabelle. Sie muss nur in die UI-Komponenten (`order-defaults-card.tsx`, `order-defaults-form.tsx`) und die Server Actions (`order-defaults.ts`) aufgenommen werden:

- `pickup_day` INTEGER (0=Sonntag, 1=Montag, ..., 6=Samstag)
- Nur relevant wenn `inbound_type = 'Abholservice durch Gudel Werkzeuge'`
- Bereits vorhanden in `tms.partner_order_defaults`

### Bestehende Tabelle: `tms.tours` (keine Änderung)

### Neue Tabelle: `tms.blocked_days`

```sql
CREATE TABLE IF NOT EXISTS tms.blocked_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    von_datum DATE NOT NULL,
    bis_datum DATE NOT NULL,
    grund TEXT NOT NULL DEFAULT 'Urlaub',
    typ TEXT NOT NULL DEFAULT 'manuell' CHECK (typ IN ('feiertag', 'manuell')),
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    erstellt_von UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    
    CONSTRAINT check_vor_bis CHECK (von_datum <= bis_datum),
    CONSTRAINT check_datum_in_future CHECK (von_datum >= CURRENT_DATE)
);

CREATE INDEX IF NOT EXISTS idx_blocked_days_von ON tms.blocked_days(von_datum);
CREATE INDEX IF NOT EXISTS idx_blocked_days_bis ON tms.blocked_days(bis_datum);

-- RLS
ALTER TABLE tms.blocked_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY blocked_days_select_policy ON tms.blocked_days
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY blocked_days_admin_policy ON tms.blocked_days
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

GRANT ALL ON tms.blocked_days TO service_role;
GRANT ALL ON tms.blocked_days TO postgres;
```

---

## API / Server Actions

### Neue Actions

| Action | Beschreibung |
|--------|-------------|
| `getNextPickupTour(partnerId)` | Gibt die nächste geplante Tour für einen Kunden zurück |
| `createPickupTour(partnerId, values)` | Erstellt eine neue Tour mit berechnetem Datum |
| `autoCreateNextPickup(partnerId, erledigtDatum)` | Wird nach Status-Wechsel zu 'erledigt' aufgerufen, erstellt automatisch nächste Tour |
| `calculateNextPickupDate(partnerId)` | Berechnet das nächste gültige Abholdatum (Wochentag + Feiertage + Blocker) |
| `getBlockedDays()` | Liste aller blockierten Zeiträume (inkl. Feiertage NRW) |
| `addBlockedPeriod(vonDatum, bisDatum, grund)` | Admin: Blocker-Zeitraum hinzufügen |
| `removeBlockedPeriod(id)` | Admin: Blocker-Zeitraum löschen |
| `isBlocked(datum)` | Prüft, ob ein Tag innerhalb eines Blocker-Zeitraums liegt (Feiertag oder manuell) |

### Bestehende Actions (Erweiterung)

- `upsertPartnerOrderDefault` — erweitern um `pickup_day`

---

## Rollen & Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Logistik-Defaults sehen | Alle eingeloggten User |
| Logistik-Defaults bearbeiten | Admin |
| Nächste Abholung sehen | Alle eingeloggten User |
| Abholung erstellen | **Alle eingeloggten User** |
| Blocker-Verwaltung sehen | Admin |
| Blocker hinzufügen/löschen | Admin |

---

## Akzeptanzkriterien

- [ ] Tab ist auf der Kundendetailseite sichtbar und heißt "Logistik & Abholung".
- [ ] Neues Feld "Abholtag" (Wochentag) in Logistik-Defaults editierbar.
- [ ] Bestehende Auftrags-Default-Daten werden weiterhin korrekt angezeigt.
- [ ] Wenn eine Tour mit `status = 'geplan'` existiert, wird sie in der "Nächste Abholung"-Karte angezeigt.
- [ ] Button "+ Abholung erstellen" erscheint nur bei Admin + "Abholservice"-Zugang + keine existierende geplante Tour.
- [ ] Beim Erstellen wird das Datum automatisch berechnet: Heute + Zyklus → auf Abholtag korrigiert → Feiertage/Blocker übersprungen.
- [ ] Neue Tour wird in `tms.tours` mit `status = 'geplan'` gespeichert.
- [ ] Wenn "Abholstatus = Automatisch" und Tour wird auf `erledigt` gesetzt, wird automatisch nächste Tour erstellt.
- [ ] Wenn "Abholstatus = Anruf", wird keine automatische Tour erstellt.
- [ ] Admin-Seite `/verwaltung/blocker` zeigt Kalender mit Feiertagen NRW (automatisch) und manuellen Blockern.
- [ ] Admin kann manuelle Blocker-Tage hinzufügen und löschen.
- [ ] Feiertage NRW werden korrekt berechnet (inkl. Ostern).
- [ ] Mobile-Ansicht ist nutzbar.

---

## Test-Szenarien

1. **Kunde hat geplante Tour** → Karte zeigt Datum, Fahrer, Status.
2. **Kunde ohne "Abholservice"-Zugang** → Kein "+ Erstellen"-Button.
3. **Admin erstellt Abholung für Donnerstags-Kunde** → Datum springt auf nächsten Donnerstag.
4. **Abholung fällt auf Feiertag** → System sucht nächsten freien Tag.
5. **Abholung fällt auf blockierten Tag** → System sucht nächsten freien Tag.
6. **"Automatisch" + Tour auf `erledigt` gesetzt** → Nächste Tour wird automatisch erstellt.
7. **"Anruf" + Tour auf `erledigt` gesetzt** → Keine automatische Tour.
8. **Blocker-Admin-Seite** → Feiertage sind sichtbar, Admin kann Urlaub eintragen.

---

## Related

- PROJ-17 (Auftrags-Default — Basis für Defaults, erweitert um `pickup_day`)
- PROJ-19 (Touren-Tabelle — Speicherort für Abholungen)
- `docs/design-system.md` (UI-Vorgaben)
