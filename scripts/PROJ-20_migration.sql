-- ============================================================
-- PROJ-20: Migration — Logistik & Abholung
-- Ausführen in Supabase SQL Editor (https://supabase.gudel-werkzeuge.de/project/sql)
-- ============================================================

-- 1) Blocker-Tabelle erstellen
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

ALTER TABLE tms.blocked_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blocked_days_select_policy ON tms.blocked_days;
DROP POLICY IF EXISTS blocked_days_admin_policy ON tms.blocked_days;

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

COMMENT ON TABLE tms.blocked_days IS 'Blocker-Tage/Zeiträume: Feiertage NRW + manuelle Einträge (Urlaub, Betriebsferien). An diesen Tagen finden keine Abholungen statt.';
COMMENT ON COLUMN tms.blocked_days.von_datum IS 'Start-Tag (inclusive)';
COMMENT ON COLUMN tms.blocked_days.bis_datum IS 'End-Tag (inclusive)';
COMMENT ON COLUMN tms.blocked_days.typ IS 'feiertag = automatisch berechnet, manuell = Admin-Eintrag';

-- 2) pickup_day Kommentar (existiert bereits)
COMMENT ON COLUMN tms.partner_order_defaults.pickup_day IS 'Abholtag: 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr. Nur relevant bei Abholservice.';

-- 3) Status-Enum umbenennen: abgeholt → erledigt
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'tms.order_status'::regtype 
        AND enumlabel = 'abgeholt'
    ) THEN
        CREATE TYPE tms.order_status_new AS ENUM (
            'geplan',
            'erledigt',
            'in_bearbeitung',
            'abgeschlossen',
            'archiviert'
        );
        
        ALTER TABLE tms.tours 
            ALTER COLUMN status TYPE tms.order_status_new 
            USING status::text::tms.order_status_new;
        
        DROP TYPE tms.order_status;
        ALTER TYPE tms.order_status_new RENAME TO order_status;
        
        RAISE NOTICE 'Status-Enum umbenannt: abgeholt → erledigt';
    END IF;
END
$$;

-- Verifizierung
SELECT 'Migration abgeschlossen' as status;
SELECT enumlabel as status_werte FROM pg_enum WHERE enumtypid = 'tms.order_status'::regtype ORDER BY enumsortorder;
SELECT COUNT(*) as blocked_days_count FROM tms.blocked_days;
