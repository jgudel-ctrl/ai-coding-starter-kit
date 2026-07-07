-- ============================================================
-- PROJ-20: Migration — KORRIGIERTE VERSION
-- Problem: tms.order_status existiert möglicherweise als order_status (ohne Schema)
-- ============================================================

-- 1) Blocker-Tabelle erstellen (UNVERÄNDERT — funktioniert)
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

-- 2) Status-Enum korrekt umbenennen
-- Prüfe erst, wie der Enum tatsächlich heißt
DO $$
DECLARE
    enum_name TEXT;
    enum_schema TEXT;
BEGIN
    -- Suche den Enum in allen Schemas
    SELECT t.typname, n.nspname 
    INTO enum_name, enum_schema
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname LIKE '%order_status%'
      AND t.typtype = 'e'
    LIMIT 1;
    
    IF FOUND THEN
        RAISE NOTICE 'Gefundener Enum: %.%', enum_schema, enum_name;
        
        -- Prüfe ob 'abgeholt' existiert
        IF EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = enum_name
            AND e.enumlabel = 'abgeholt'
        ) THEN
            -- Erstelle neuen Enum mit korrigiertem Wert
            EXECUTE format('CREATE TYPE %I.%I AS ENUM (
                ''geplan'', ''erledigt'', ''in_bearbeitung'', ''abgeschlossen'', ''archiviert''
            )', enum_schema, enum_name || '_new');
            
            -- Spalte umstellen
            EXECUTE format('ALTER TABLE tms.tours ALTER COLUMN status TYPE %I.%I USING status::text::%I.%I',
                enum_schema, enum_name || '_new',
                enum_schema, enum_name || '_new');
            
            -- Alten Enum löschen
            EXECUTE format('DROP TYPE %I.%I', enum_schema, enum_name);
            
            -- Neuen Enum umbenennen
            EXECUTE format('ALTER TYPE %I.%I RENAME TO %I', 
                enum_schema, enum_name || '_new', enum_name);
            
            RAISE NOTICE 'Status-Enum erfolgreich aktualisiert: abgeholt → erledigt';
        ELSE
            RAISE NOTICE 'Status "abgeholt" nicht gefunden — überspringe Umbenennung';
        END IF;
    ELSE
        RAISE NOTICE 'Kein order_status Enum gefunden — überspringe';
    END IF;
END
$$;

-- 3) Verifizierung
SELECT 'Migration abgeschlossen' as status;

-- Zeige alle order_status Enums
SELECT 
    n.nspname as schema,
    t.typname as enum_name,
    e.enumlabel as wert
FROM pg_type t
JOIN pg_namespace n ON t.typnamespace = n.oid
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE t.typname LIKE '%order_status%'
ORDER BY n.nspname, t.typname, e.enumsortorder;

-- Zeige Blocker-Tabelle
SELECT COUNT(*) as blocked_days_count FROM tms.blocked_days;
