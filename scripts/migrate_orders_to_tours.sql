-- Migration: Tabelle tms.orders → tms.tours umbenennen
-- PROJ-19 Follow-up: Naming-Korrektur
-- Erstellt: 2026-07-06
-- Auswirkung: Tabelle war fälschlicherweise "orders" (Bestellungen), ist aber "Touren" (Fahrer, Abholdaten)

BEGIN;

-- 1. Tabelle umbenennen
ALTER TABLE tms.orders RENAME TO tours;

-- 2. Sequenzen (falls vorhanden) werden automatisch umbenannt
-- 3. Indizes werden automatisch umbenannt (PostgreSQL behält sie bei)
-- 4. Constraints werden automatisch umbenannt

-- 5. Trigger-Funktion und Trigger umbenennen
DROP TRIGGER IF EXISTS update_orders_modified ON tms.tours;
DROP TRIGGER IF EXISTS update_tours_modified ON tms.tours;

-- Trigger-Funktion neu erstellen (sicheres Vorgehen)
CREATE OR REPLACE FUNCTION tms.update_tours_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geaendert_am = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tours_modified
    BEFORE UPDATE ON tms.tours
    FOR EACH ROW
    EXECUTE FUNCTION tms.update_tours_modified_column();

-- Alte Funktion löschen (nachdem der neue Trigger darauf zeigt)
DROP FUNCTION IF EXISTS tms.update_orders_modified_column();

-- 6. RLS-Policies: Alte löschen, neue erstellen
-- (Policies sind an Tabellennamen gebunden, müssen neu erstellt werden)

DROP POLICY IF EXISTS orders_select_policy ON tms.tours;
DROP POLICY IF EXISTS orders_update_admin_policy ON tms.tours;
DROP POLICY IF EXISTS orders_insert_admin_policy ON tms.tours;
DROP POLICY IF EXISTS orders_delete_admin_policy ON tms.tours;

-- Neue Policies
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

-- 7. Kommentare aktualisieren
COMMENT ON TABLE tms.tours IS 'Touren - Fahrer-Aufträge/Abholungen bei Kunden';
COMMENT ON COLUMN tms.tours.status IS 'Status: geplant, abgeholt, in_bearbeitung, abgeschlossen, archiviert';
COMMENT ON COLUMN tms.tours.geplantes_abholdatum IS 'Wann soll der Fahrer vorbeikommen?';
COMMENT ON COLUMN tms.tours.tatsaechliches_abholdatum IS 'Wann wurde tatsächlich abgeholt?';

-- 8. Berechtigungen
GRANT ALL ON tms.tours TO service_role;
GRANT ALL ON tms.tours TO postgres;

-- 9. Verifizierung
SELECT 'Tabelle umbenannt:' as info, tablename FROM pg_tables WHERE tablename = 'tours' AND schemaname = 'tms';
SELECT 'Indizes:' as info, indexname FROM pg_indexes WHERE tablename = 'tours' AND schemaname = 'tms';
SELECT 'Policies:' as info, policyname FROM pg_policies WHERE tablename = 'tours' AND schemaname = 'tms';
SELECT 'Trigger:' as info, trigger_name FROM information_schema.triggers WHERE event_object_table = 'tours' AND trigger_schema = 'tms';
SELECT 'Anzahl Datensätze:' as info, COUNT(*)::text as count FROM tms.tours;

COMMIT;
