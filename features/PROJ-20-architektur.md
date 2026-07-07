# PROJ-20 · Architektur: Logistik & Abholung

**Status:** Architected  
**Scope:** Kundendetail — Tab erweitern + "Nächste Abholung"-Karte + Blocker-Verwaltung  
**Tech-Stack:** Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, Supabase (self-hosted)

---

## 1. Übersicht

PROJ-20 erweitert den bestehenden "Auftrags-Default"-Tab auf der Kundendetailseite zu **"Logistik & Abholung"** und fügt eine "Nächste Abholung"-Karte hinzu. Zusätzlich wird eine **Blocker-Verwaltung** (Admin-Seite für Feiertage und Urlaub) eingeführt.

### Kern-Entscheidungen

| Entscheidung | Begründung |
|-------------|-----------|
| **Keine DB-Migration nötig** für `pickup_day` | Feld existiert bereits in `tms.partner_order_defaults`, muss nur in UI/Actions integriert werden |
| **Neue Tabelle `tms.blocked_days`** | Zeitraum-basiert (`von_datum`/`bis_datum`) statt Einzeltage — ermöglicht Urlaubs-Wochen und Betriebsferien |
| **Feiertage werden automatisch berechnet** | Gauß-Algorithmus für Ostern, restliche Feiertage fix — werden beim ersten Aufruf der Blocker-Verwaltung in die DB eingetragen |
| **Status `abgeholt` → `erledigt` umbenennen** | Klarere Semantik: Die Tour ist für den Kunden abgeschlossen |
| **Server Actions für alle DB-Operationen** | Konsistent mit bestehendem Pattern, RLS + Service Role für Schreiben |

---

## 2. Datenbank-Schema

### Bestehende Tabellen (keine Änderung)

- `tms.tours` — Speichert alle Touren/Abholungen
- `tms.partner_order_defaults` — `pickup_day` existiert bereits, wird nur in UI/Actions aufgenommen

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
    
    CONSTRAINT check_vor_bis CHECK (von_datum <= bis_datum)
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

**Entscheidung:** Kein Constraint `check_datum_in_future` — Urlaub kann auch nachträglich eingetragen werden.

---

## 3. Server Actions (neu + erweitert)

### Neue Actions

| Action | File | Beschreibung |
|--------|------|-------------|
| `getNextPickupTour` | `pickup-tours.ts` | Nächste geplante Tour für einen Kunden |
| `createPickupTour` | `pickup-tours.ts` | Neue Tour erstellen mit berechnetem Datum |
| `autoCreateNextPickup` | `pickup-tours.ts` | Nach `erledigt`-Status automatisch nächste Tour erstellen |
| `calculateNextPickupDate` | `pickup-utils.ts` | Datum berechnen: Zyklus + Abholtag + Feiertage/Blocker |
| `getBlockedPeriods` | `blocked-days.ts` | Alle Blocker-Zeiträume (inkl. Feiertage) |
| `addBlockedPeriod` | `blocked-days.ts` | Admin: Blocker-Zeitraum hinzufügen |
| `removeBlockedPeriod` | `blocked-days.ts` | Admin: Blocker-Zeitraum löschen |
| `isBlockedDate` | `blocked-days.ts` | Prüft ob ein Tag blockiert ist |
| `initializeHolidays` | `blocked-days.ts` | Feiertage NRW berechnen und in DB eintragen (einmalig) |

### Erweiterte Actions

| Action | Änderung |
|--------|---------|
| `upsertPartnerOrderDefault` | Um `pickup_day` erweitern |
| `getPartnerOrderDefault` | `pickup_day` zurückgeben |

### Datei-Struktur

```
src/lib/actions/
├── order-defaults.ts              ← Erweitern um pickup_day
├── pickup-tours.ts                ← NEU: Tour-CRUD + Auto-Erstellung
├── pickup-utils.ts                ← NEU: Datum-Berechnung + Feiertage-Logik
├── blocked-days.ts                ← NEU: Blocker-Verwaltung
└── ... (bestehende Actions unverändert)
```

---

## 4. Frontend-Komponenten

### Bestehende Komponenten (Änderungen)

| Komponente | Änderung |
|-----------|---------|
| `tab-container.tsx` | Icon `ClipboardList` → `Truck`, Label "Auftrags-Default" → "Logistik & Abholung" |
| `order-defaults-card.tsx` | Feld `pickup_day` (Wochentag) anzeigen |
| `order-defaults-form.tsx` | Dropdown "Abholtag" (Montag–Freitag) hinzufügen, nur bei Abholservice-Zugang sichtbar |

### Neue Komponenten

| Komponente | Ort | Beschreibung |
|-----------|-----|-------------|
| `next-pickup-card.tsx` | `kunden/[id]/components/` | Zeigt nächste geplante Tour oder Leer-Zustand mit "+ Erstellen"-Button |
| `create-pickup-modal.tsx` | `kunden/[id]/components/` | Modal zum Erstellen einer Abholung (Date-Picker, Fahrer, Notiz) |
| `blocked-days-page.tsx` | `app/(app)/verwaltung/blocker/` | Admin-Seite: Kalender + Blocker-Verwaltung |

### Datei-Struktur (neu)

```
src/app/(app)/kunden/[id]/components/
├── next-pickup-card.tsx           ← NEU
├── create-pickup-modal.tsx        ← NEU
├── ... (bestehende unverändert)

src/app/(app)/verwaltung/blocker/
├── page.tsx                       ← NEU: Admin-Seite
├── components/
│   ├── calendar-view.tsx          ← NEU: Monatskalender
│   ├── blocked-period-list.tsx    ← NEU: Liste der Zeiträume
│   └── add-blocker-modal.tsx      ← NEU: Zeitraum hinzufügen
```

---

## 5. Feiertags-Berechnung (NRW)

### Algorithmus: Gauß-Osterformel

```typescript
// Beispiel-Implementierung (vereinfacht)
function calculateEasterSunday(year: number): Date {
    // Gauß-Algorithmus
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
}
```

### Feiertage NRW (fix + beweglich)

| Feiertag | Berechnung |
|----------|-----------|
| Neujahr | 1. Januar |
| Karfreitag | Ostersonntag - 2 Tage |
| Ostermontag | Ostersonntag + 1 Tag |
| Tag der Arbeit | 1. Mai |
| Christi Himmelfahrt | Ostersonntag + 39 Tage |
| Pfingstmontag | Ostersonntag + 50 Tage |
| Fronleichnam | Ostersonntag + 60 Tage |
| Tag der Deutschen Einheit | 3. Oktober |
| Allerheiligen | 1. November |
| 1. Weihnachtstag | 25. Dezember |
| 2. Weihnachtstag | 26. Dezember |

### Initialisierung

```typescript
// Beim ersten Laden der Blocker-Verwaltung:
// 1. Prüfen: Gibt es bereits Feiertage in tms.blocked_days?
// 2. Falls nein: Feiertage für aktuelles + nächstes Jahr berechnen
// 3. Als typ='feiertag' in tms.blocked_days eintragen
```

---

## 6. Datum-Berechnung: `calculateNextPickupDate`

```
Eingabe: partnerId

1. Lade Defaults (abholzyklus_wochen, pickup_day, fahrer_id)
2. Falls kein Zyklus oder kein Abholtag → Fehler
3. Startdatum = heute + abholzyklus_wochen * 7 Tage
4. Korrigiere auf nächsten pickup_day (Wochentag)
5. WHILE Startdatum ist blockiert (Feiertag/Urlaub/Wochenende):
   Startdatum += 1 Tag
   Korrigiere auf nächsten pickup_day
6. Gib Startdatum zurück
```

**Entscheidung:** Samstag/Sonntag werden immer übersprungen (unabhängig von Blocker-Tabelle).

---

## 7. Auto-Erstellung nach "Erledigt"

### Trigger-Punkt

```
Wenn: Tour-Status wird von 'geplan' auf 'erledigt' gesetzt
Ort:  In der Touren-Übersicht (nicht im Kunden-Detail)
Wer:  Fahrer oder Admin
```

### Logik

```
1. Lade partner_order_defaults für diesen Kunden
2. Prüfe: abholservice == true? (Abholstatus = "Automatisch")
3. Falls ja:
   a. Berechne neues Datum: calculateNextPickupDate(partnerId)
   b. Erstelle neue Tour mit:
      - status = 'geplan'
      - geplantes_abholdatum = berechnetes Datum
      - fahrer_id, zugang, ruecksendung aus Defaults
      - titel = "Automatisch erstellt"
4. Falls nein (Abholstatus = "Anruf"):
   a. Tue nichts
   b. Kunde muss manuell neue Abholung erstellen
```

---

## 8. RLS & Berechtigungen

| Ressource | SELECT | INSERT | UPDATE | DELETE |
|-----------|--------|--------|--------|--------|
| `tms.tours` | Alle eingeloggt | Admin | Admin | Admin |
| `tms.blocked_days` | Alle eingeloggt | Admin | Admin | Admin |
| `tms.partner_order_defaults` | Alle eingeloggt | Admin | Admin | — |

**Entscheidung:** `tms.tours` Insert/Update bleibt Admin-only. Auto-Erstellung läuft über Service Role (Server Action).

---

## 9. Fehlerbehandlung & Edge Cases

| Edge Case | Lösung |
|-----------|--------|
| Kunde hat keinen `pickup_day` gesetzt | Datum-Default = heute + Zyklus (kein Wochentag-Zwang) |
| Kunde hat keinen Abholzyklus | Button "+ Erstellen" trotzdem sichtbar, Datum = heute |
| Berechnung landet > 1 Jahr in Zukunft | Warnung im UI, aber erlaubt |
| Feiertag-Berechnung fehlschlägt | Fallback: Nur fixe Feiertage (1.1, 1.5, 3.10, 1.11, 25.12, 26.12) |
| Zwei Kunden haben gleichen Abholtag/Fahrer | Keine Prüfung (Out of Scope) |
| `erledigt`-Status wird gesetzt, aber keine Defaults | Log-Eintrag, keine Auto-Erstellung |

---

## 10. Abhängigkeiten & Reihenfolge

### Muss vor PROJ-20 fertig sein:
- ✅ PROJ-17 (Auftrags-Default — Datenmodell + UI)
- ✅ PROJ-19 (Touren-Tabelle `tms.tours`)

### Kann parallel zu PROJ-20 gebaut werden:
- Touren-Übersicht (wo der Status `geplan` → `erledigt` gesetzt wird)

### Reihenfolge innerhalb PROJ-20:
1. **Backend:** `pickup_day` in Actions integrieren + `tms.blocked_days` Tabelle
2. **Backend:** Feiertags-Berechnung + Datum-Logik
3. **Frontend:** Tab umbenennen + `pickup_day` in Defaults-Form
4. **Frontend:** "Nächste Abholung"-Karte + Modal
5. **Frontend:** Auto-Erstellung nach `erledigt`
6. **Frontend:** Blocker-Verwaltung (Admin-Seite)
7. **QA:** Tests gegen Akzeptanzkriterien

---

## 11. Performance

- **Indexe:** `idx_tours_partner_id`, `idx_tours_status` (bereits vorhanden)
- **Neue Indexe:** `idx_blocked_days_von`, `idx_blocked_days_bis`
- **Berechnung:** Feiertage werden einmalig pro Jahr berechnet und gecacht
- **Datum-Berechnung:** Max. 365 Iterationen (Worst Case), typisch < 10

---

## Related

- `features/PROJ-20-logistik-abholung.md` (Spec)
- `features/PROJ-17-architektur.md` (Auftrags-Default)
- `features/PROJ-19-architektur.md` (Touren-Tabelle)
