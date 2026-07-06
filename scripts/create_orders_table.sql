-- Migration: Erstelle orders Tabelle (Auftragsverwaltung)
-- PROJ-19

-- Enum-Typen erstellen (falls noch nicht vorhanden)
DO $$ BEGIN
    CREATE TYPE zugang_type AS ENUM ('Bringen', 'Abholservice', 'Spedition');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ruecksendung_type AS ENUM ('Lieferung', 'Abholung');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Status-Enum für Aufträge
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

-- Tabelle: orders (Aufträge)
CREATE TABLE IF NOT EXISTS tms.orders (
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
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON tms.orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON tms.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_fahrer_id ON tms.orders(fahrer_id);
CREATE INDEX IF NOT EXISTS idx_orders_geplantes_abholdatum ON tms.orders(geplantes_abholdatum);
CREATE INDEX IF NOT EXISTS idx_orders_tatsaechliches_abholdatum ON tms.orders(tatsaechliches_abholdatum);
CREATE INDEX IF NOT EXISTS idx_orders_erstellt_am ON tms.orders(erstellt_am DESC);

-- Trigger: Auto-Update geaendert_am
CREATE OR REPLACE FUNCTION tms.update_orders_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geaendert_am = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_modified ON tms.orders;
CREATE TRIGGER update_orders_modified
    BEFORE UPDATE ON tms.orders
    FOR EACH ROW
    EXECUTE FUNCTION tms.update_orders_modified_column();

-- RLS aktivieren
ALTER TABLE tms.orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Alle eingeloggten User können lesen
CREATE POLICY orders_select_policy ON tms.orders
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Nur Admins können alle Aufträge bearbeiten
CREATE POLICY orders_update_admin_policy ON tms.orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Nur Admins können neue Aufträge anlegen
CREATE POLICY orders_insert_admin_policy ON tms.orders
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Admins können löschen
CREATE POLICY orders_delete_admin_policy ON tms.orders
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Kommentare
COMMENT ON TABLE tms.orders IS 'Aufträge - Arbeitsaufträge von Kunden';
COMMENT ON COLUMN tms.orders.status IS 'Status: geplant, abgeholt, in_bearbeitung, abgeschlossen, archiviert';
COMMENT ON COLUMN tms.orders.geplantes_abholdatum IS 'Wann soll der Fahrer vorbeikommen?';
COMMENT ON COLUMN tms.orders.tatsaechliches_abholdatum IS 'Wann wurde tatsächlich abgeholt?';

-- Service Role Grant
GRANT ALL ON tms.orders TO service_role;
GRANT ALL ON tms.orders TO postgres;
