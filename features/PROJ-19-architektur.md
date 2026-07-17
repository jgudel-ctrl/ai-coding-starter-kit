# PROJ-19 — Architektur: Auftragsverwaltung Datenbank

**Status:** 🔵 In Review  
**Scope:** Datenbank-Schema + Migrationsscript für CSV-Import

---

## Zusammenfassung

Aufbau der `orders`-Tabelle (Aufträge) in Supabase mit:
1. **Schema-Definition** (Tabelle, Typen, Constraints)
2. **RLS-Policies** (Zugriffsrechte)
3. **Trigger** (Auto-Defaults beim Anlegen)
4. **Migrationsscript** (CSV-Import der historischen Daten)

---

## Datenbank-Schema

### 1. Custom Types (Enum)

```sql
-- Falls noch nicht existiert (wurde in PROJ-17 evtl. schon angelegt)
DO $$ BEGIN
    CREATE TYPE zugang_type AS ENUM ('Bringen', 'Abholservice', 'Spedition');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ruecksendung_type AS ENUM ('Lieferung', 'Abholung');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Neuer Typ für Auftrags-Status
CREATE TYPE order_status AS ENUM (
    'geplant',           -- Fahrer soll noch vorbeikommen
    'abgeholt',          -- Waren wurden abgeholt
    'in_bearbeitung',    -- Im QS / Wareneingang
    'abgeschlossen',     -- Fertig, kann zurückgeschickt werden
    'archiviert'         -- Historisch, abgeschlossen
);
```

### 2. Tabelle: `orders`

```sql
CREATE TABLE tms.orders (
    -- Primärschlüssel
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Verknüpfung zum Kunden (Pflichtfeld)
    partner_id UUID NOT NULL REFERENCES tms.partners(id) ON DELETE RESTRICT,
    
    -- Auftrags-Identifikation (optional, für Zukunft)
    auftragsnummer TEXT UNIQUE,
    titel TEXT,
    beschreibung TEXT,
    
    -- Status des Auftrags
    status order_status NOT NULL DEFAULT 'geplant',
    
    -- Auftrags-Defaults (vom Kunden übernommen beim Anlegen)
    zugang zugang_type NOT NULL DEFAULT 'Bringen',
    ruecksendung ruecksendung_type NOT NULL DEFAULT 'Lieferung',
    fahrer_id UUID REFERENCES tms.users(id) ON DELETE SET NULL,
    abholzyklus_wochen INTEGER CHECK (abholzyklus_wochen >= 0 AND abholzyklus_wochen <= 52),
    abholservice BOOLEAN NOT NULL DEFAULT false,
    
    -- Abholdatum-Felder (wichtig für Fahrer-Planung)
    geplantes_abholdatum DATE,
    tatsaechliches_abholdatum DATE,
    
    -- Metadaten
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    geaendert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    erstellt_von UUID NOT NULL REFERENCES tms.users(id) ON DELETE RESTRICT,
    
    -- Constraints
    CONSTRAINT check_abholservice_consistent 
        CHECK (abholservice = false OR abholzyklus_wochen IS NOT NULL)
);

-- Indizes für Performance
CREATE INDEX idx_orders_partner_id ON tms.orders(partner_id);
CREATE INDEX idx_orders_status ON tms.orders(status);
CREATE INDEX idx_orders_fahrer_id ON tms.orders(fahrer_id);
CREATE INDEX idx_orders_geplantes_abholdatum ON tms.orders(geplantes_abholdatum);
CREATE INDEX idx_orders_tatsaechliches_abholdatum ON tms.orders(tatsaechliches_abholdatum);
CREATE INDEX idx_orders_erstellt_am ON tms.orders(erstellt_am DESC);
```

### 3. Trigger: Auto-Update `geaendert_am`

```sql
CREATE OR REPLACE FUNCTION tms.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geaendert_am = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_modified
    BEFORE UPDATE ON tms.orders
    FOR EACH ROW
    EXECUTE FUNCTION tms.update_modified_column();
```

### 4. RLS (Row Level Security)

```sql
-- RLS aktivieren
ALTER TABLE tms.orders ENABLE ROW LEVEL SECURITY;

-- Alle eingeloggten User können lesen
CREATE POLICY orders_select_policy ON tms.orders
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Nur Admins können alle Aufträge bearbeiten
CREATE POLICY orders_update_admin_policy ON tms.orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM tms.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Nur Admins können neue Aufträge anlegen
CREATE POLICY orders_insert_admin_policy ON tms.orders
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tms.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admins können löschen
CREATE POLICY orders_delete_admin_policy ON tms.orders
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM tms.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

---

## Migrationsscript: CSV-Import

### Vorbereitung

Die CSV hat 3 Spalten:
- `Kundennummer` → `partners.id` (mapping über partner_code oder eigene Nummer)
- `Datum Abholung` → `geplantes_abholdatum` oder `tatsaechliches_abholdatum`
- `Status` → Mapping zu `order_status`

### Status-Mapping

| CSV-Status | Datenbank-Status | Abholdatum-Feld |
|------------|------------------|-----------------|
| `Werkzeuge abholen` | `geplant` | `geplantes_abholdatum` |
| `Wareneingang` | `abgeholt` | `tatsaechliches_abholdatum` |
| `Archiv` | `archiviert` | `tatsaechliches_abholdatum` |

### Import-Logik (SQL)

```sql
-- Temp-Tabelle für CSV-Upload
CREATE TEMP TABLE temp_orders_import (
    kundennummer TEXT,
    datum_abholung TEXT,
    status TEXT
);

-- COPY-Befehl für CSV (ausgeführt via psql oder Supabase Dashboard)
-- COPY temp_orders_import FROM '/path/to/abholung.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

-- Insert mit Mapping
INSERT INTO tms.orders (
    partner_id,
    status,
    geplantes_abholdatum,
    tatsaechliches_abholdatum,
    zugang,
    ruecksendung,
    fahrer_id,
    abholzyklus_wochen,
    abholservice,
    erstellt_von,
    titel
)
SELECT 
    p.id as partner_id,
    CASE ti.status
        WHEN 'Werkzeuge abholen' THEN 'geplant'::order_status
        WHEN 'Wareneingang' THEN 'abgeholt'::order_status
        WHEN 'Archiv' THEN 'archiviert'::order_status
        ELSE 'geplant'::order_status
    END as status,
    CASE 
        WHEN ti.status = 'Werkzeuge abholen' THEN ti.datum_abholung::date
        ELSE NULL
    END as geplantes_abholdatum,
    CASE 
        WHEN ti.status != 'Werkzeuge abholen' THEN ti.datum_abholung::date
        ELSE NULL
    END as tatsaechliches_abholdatum,
    COALESCE(pdv.zugang, 'Bringen') as zugang,
    COALESCE(pdv.ruecksendung, 'Lieferung') as ruecksendung,
    pdv.fahrer_id,
    pdv.abholzyklus_wochen,
    COALESCE(pdv.abholservice, false) as abholservice,
    '00000000-0000-0000-0000-000000000000'::uuid as erstellt_von, -- System-User
    'Migration aus Alt-System' as titel
FROM temp_orders_import ti
LEFT JOIN tms.partners p ON p.partner_code = ti.kundennummer
LEFT JOIN tms.partner_default_values pdv ON pdv.partner_id = p.id
WHERE ti.kundennummer IS NOT NULL AND ti.kundennummer != '';

-- Cleanup
DROP TABLE temp_orders_import;
```

### Hinweise zum Import

1. **Kundennummer-Mapping**: Die CSV hat `Kundennummer` als String. Wir verknüpfen über `partners.partner_code` (oder falls anders benannt, über ID).
2. **Fehlende Kunden**: Wenn eine Kundennummer in `partners` nicht existiert, wird der Datensatz nicht importiert (NULL bei LEFT JOIN → WHERE schließt aus).
3. **System-User**: `erstellt_von` wird auf einen System-User gesetzt. Kann später auf einen realen Admin-User geändert werden.
4. **Duplikate**: Die CSV enthält mehrere Einträge pro Kunde (z.B. 11011 hat mehrere Termine). Das ist korrekt – jede Abholung ist ein eigener Auftrag.

---

## Files zu erstellen

1. `supabase/migrations/YYYYMMDDHHMMSS_create_orders_table.sql` — Schema + RLS + Trigger
2. `scripts/import_orders_from_csv.sql` — CSV-Import Script (manuell ausführen)

---

## Risiken & Abhängigkeiten

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Kundennummern in CSV passen nicht zu `partners` | Mittel | Vorab prüfen: `SELECT DISTINCT kundennummer FROM temp_orders_import WHERE kundennummer NOT IN (SELECT partner_code FROM partners)` |
| Datumsformat in CSV inkonsistent | Niedrig | PostgreSQL `::date` cast ist robust, aber wir sollten probehalber testen |
| `partner_default_values` fehlt für manche Kunden | Niedrig | `COALESCE` mit Default-Werten |

---

## Testing (nach Deploy)

```sql
-- Test 1: Tabelle existiert
SELECT COUNT(*) FROM tms.orders;

-- Test 2: Import erfolgreich (Anzahl sollte ~114 sein)
SELECT 
    status, 
    COUNT(*) as anzahl,
    MIN(geplantes_abholdatum) as fruehestes_geplant,
    MAX(tatsaechliches_abholdatum) as letztes_tatsaechlich
FROM tms.orders
GROUP BY status;

-- Test 3: Verknüpfung zu Kunden funktioniert
SELECT o.id, p.company_name, o.status, o.geplantes_abholdatum
FROM tms.orders o
JOIN tms.partners p ON p.id = o.partner_id
LIMIT 10;

-- Test 4: RLS funktioniert (als nicht-Admin sollte Insert fehlschlagen)
-- (Manuell testen via App)
```

---

## Nächste Schritte (nach diesem PR)

1. **UI für Auftragsübersicht** — Liste aller Aufträge mit Filter/Sortierung
2. **UI für Auftrags-Detail** — Bearbeiten, Status-ändern, Kommentare
3. **Fahrer-Ansicht** — Mobile Übersicht "Meine heutigen Abholungen"
4. **Automatische Abholplanung** — Basierend auf `abholzyklus_wochen` neue Aufträge generieren

---

**Warte auf Approval von Jan Bernd bevor ich mit Frontend/Backend beginne.**
