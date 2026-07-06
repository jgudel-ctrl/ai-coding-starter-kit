-- Migration: Erstelle tours Tabelle (Tourenverwaltung)
-- PROJ-19 (umbenannt von orders → tours am 2026-07-06)
-- Die Tabelle enthält Touren/Abholungen (Fahrer, Abholdatum), nicht Bestellungen

-- Enum-Typen erstellen (falls noch nicht vorhanden)
DO $$ BEGIN
    CREATE TYPE zugang_type AS ENUM ('Bringen', 'Abholservice', 'Spedition');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ruecksendung_type AS ENUM ('Lieferung', 'Abholung');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status-Enum für Touren
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'geplant',           -- Fahrer soll noch vorbeikommen
        'abgeholt',          -- Waren wurden abgeholt
        'in_bearbeitung',    -- Im QS / Wareneingang
        'abgeschlossen',     -- Fertig, kann zurückgeschickt werden
        'archiviert'         -- Historisch, abgeschlossen
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabelle: tours (Touren)
CREATE TABLE IF NOT EXISTS tms.tours (
    -- Primärschlüssel
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Verknüpfung zum Kunden (Pflichtfeld)
    partner_id UUID NOT NULL REFERENCES tms.partners(id) ON DELETE RESTRICT,
    
    -- Auftrags-Identifikation (optional, für Zukunft)
    auftragsnummer TEXT UNIQUE,
    titel TEXT,
    beschreibung TEXT,
    
    -- Status der Tour
    status order_status NOT NULL DEFAULT 'geplant',
    
    -- Auftrags-Defaults (vom Kunden übernommen beim Anlegen)
    zugang TEXT NOT NULL DEFAULT 'Bringen',
    ruecksendung TEXT NOT NULL DEFAULT 'Lieferung',
    fahrer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    abholzyklus_wochen INTEGER CHECK (abholzyklus_wochen >= 0 AND abholzyklus_wochen <= 52),
    abholservice BOOLEAN NOT NULL DEFAULT false,
    
    -- Abholdatum-Felder (wichtig für Fahrer-Planung)
    geplantes_abholdatum DATE,
    tatsaechliches_abholdatum DATE,
    
    -- Metadaten
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    geaendert_am TIMESTAMPTZ NOT NULL DEFAULT now(),
    erstellt_von UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    
    -- Constraints
    CONSTRAINT check_abholservice_consistent 
        CHECK (abholservice = false OR abholzyklus_wochen IS NOT NULL)
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_tours_partner_id ON tms.tours(partner_id);
CREATE INDEX IF NOT EXISTS idx_tours_status ON tms.tours(status);
CREATE INDEX IF NOT EXISTS idx_tours_fahrer_id ON tms.tours(fahrer_id);
CREATE INDEX IF NOT EXISTS idx_tours_geplantes_abholdatum ON tms.tours(geplantes_abholdatum);
CREATE INDEX IF NOT EXISTS idx_tours_tatsaechliches_abholdatum ON tms.tours(tatsaechliches_abholdatum);
CREATE INDEX IF NOT EXISTS idx_tours_erstellt_am ON tms.tours(erstellt_am DESC);

-- Trigger: Auto-Update geaendert_am
CREATE OR REPLACE FUNCTION tms.update_tours_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geaendert_am = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tours_modified ON tms.tours;
CREATE TRIGGER update_tours_modified
    BEFORE UPDATE ON tms.tours
    FOR EACH ROW
    EXECUTE FUNCTION tms.update_tours_modified_column();

-- RLS aktivieren
ALTER TABLE tms.tours ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY tours_select_policy ON tms.tours
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY tours_update_admin_policy ON tms.tours
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY tours_insert_admin_policy ON tms.tours
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY tours_delete_admin_policy ON tms.tours
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Kommentare
COMMENT ON TABLE tms.tours IS 'Touren - Fahrer-Aufträge/Abholungen bei Kunden';
COMMENT ON COLUMN tms.tours.status IS 'Status: geplant, abgeholt, in_bearbeitung, abgeschlossen, archiviert';
COMMENT ON COLUMN tms.tours.geplantes_abholdatum IS 'Wann soll der Fahrer vorbeikommen?';
COMMENT ON COLUMN tms.tours.tatsaechliches_abholdatum IS 'Wann wurde tatsächlich abgeholt?';

-- Service Role Grant
GRANT ALL ON tms.tours TO service_role;
GRANT ALL ON tms.tours TO postgres;
