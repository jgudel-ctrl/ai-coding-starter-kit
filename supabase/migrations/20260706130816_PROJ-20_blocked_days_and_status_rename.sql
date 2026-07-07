-- PROJ-20: Logistik & Abholung
-- 1) Blocker-Tabelle für Feiertage + Urlaub (Zeitraum-basiert)
-- 2) Status-Enum umbenennen: abgeholt → erledigt
-- 3) pickup_day Kommentar (existiert bereits)

-- ============================================
-- 1) Blocker-Tabelle: Feiertage + Urlaub/Betriebsferien
-- ============================================
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

-- ============================================
-- 2) Kommentar für pickup_day (existiert bereits)
-- ============================================
COMMENT ON COLUMN tms.partner_order_defaults.pickup_day IS 'Abholtag: 0=So, 1=Mo, ..., 6=Sa. Nur relevant bei Abholservice.';

-- ============================================
-- 3) Status-Enum: abgeholt → erledigt umbenennen
--    Hinweis: PostgreSQL ENUM-Werte können nicht direkt umbenannt werden.
--    Wir erstellen einen neuen Enum-Typ, migrieren die Daten, und löschen den alten.
-- ============================================

DO $$
BEGIN
    -- Prüfe ob der alte Enum-Wert 'abgeholt' existiert
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'tms.order_status'::regtype 
        AND enumlabel = 'abgeholt'
    ) THEN
        -- Schritt 1: Temporären Enum-Typ erstellen mit neuem Wert
        CREATE TYPE tms.order_status_new AS ENUM (
            'geplan',
            'erledigt',
            'in_bearbeitung',
            'abgeschlossen',
            'archiviert'
        );
        
        -- Schritt 2: Spalte auf temporären Typ umstellen
        ALTER TABLE tms.tours 
            ALTER COLUMN status TYPE tms.order_status_new 
            USING status::text::tms.order_status_new;
        
        -- Schritt 3: Alten Enum-Typ löschen
        DROP TYPE tms.order_status;
        
        -- Schritt 4: Neuen Typ auf alten Namen umbenennen
        ALTER TYPE tms.order_status_new RENAME TO order_status;
        
        RAISE NOTICE 'Status-Enum erfolgreich umbenannt: abgeholt → erledigt';
    ELSE
        RAISE NOTICE 'Status abgeholt nicht gefunden — überspringe Umbenennung';
    END IF;
END
$$;

-- Verifizierung
SELECT 'Migration abgeschlossen' as status;
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'tms.order_status'::regtype ORDER BY enumsortorder;
SELECT COUNT(*) as blocked_days_count FROM tms.blocked_days;
