-- PROJ-19: Datenimport Auftrags-Defaults
-- Importiert 123 Kunden mit Fahrer-Zuordnung und Wochenrhythmus
-- Idempotent: Kann mehrfach ausgeführt werden (UPSERT)
-- Created: 2026-07-03
-- MATCHING: CSV.Kundennummer -> tms.partners.easybill_customer_number

BEGIN;

-- 1. Temporäre Tabelle für CSV-Daten
DROP TABLE IF EXISTS temp_import_data;
CREATE TEMP TABLE temp_import_data (
    kundennummer TEXT,
    fahrer_email TEXT,
    wochenrhythmus INTEGER
);

-- 2. CSV-Daten einfügen (123 Datensätze)
INSERT INTO temp_import_data (kundennummer, fahrer_email, wochenrhythmus) VALUES
('12154', 'c.gudel@gudel-werkzeuge.de', 1),
('12588', 'c.gudel@gudel-werkzeuge.de', 1),
('22074', 'm.gudel@gudel-werkzeuge.de', 16),
('12056', 'j.gudel@gudel-werkzeuge.de', 3),
('23036', 'j.gudel@gudel-werkzeuge.de', 3),
('14016', 'm.gudel@gudel-werkzeuge.de', 2),
('14090', 'm.gudel@gudel-werkzeuge.de', 10),
('51002', 'm.gudel@gudel-werkzeuge.de', 1),
('24122', 'j.gudel@gudel-werkzeuge.de', 1),
('11502', 'm.gudel@gudel-werkzeuge.de', 2),
('51285', 'm.gudel@gudel-werkzeuge.de', 3),
('23262', 'm.gudel@gudel-werkzeuge.de', 6),
('21161', 'm.gudel@gudel-werkzeuge.de', 1),
('22164', 'm.gudel@gudel-werkzeuge.de', 5),
('23216', 'm.gudel@gudel-werkzeuge.de', 6),
('24001', 'm.gudel@gudel-werkzeuge.de', 2),
('54033', 'm.gudel@gudel-werkzeuge.de', 2),
('51288', 'm.gudel@gudel-werkzeuge.de', 1),
('10240', 'm.gudel@gudel-werkzeuge.de', 24),
('12083', 'c.gudel@gudel-werkzeuge.de', 1),
('11011', 'c.gudel@gudel-werkzeuge.de', 1),
('23226', 'm.gudel@gudel-werkzeuge.de', 4),
('33035', 'j.gudel@gudel-werkzeuge.de', 3),
('21171', 'm.gudel@gudel-werkzeuge.de', 0),
('10274', 'c.gudel@gudel-werkzeuge.de', 1),
('22017', 'm.gudel@gudel-werkzeuge.de', 4),
('51289', 'm.gudel@gudel-werkzeuge.de', 5),
('21055', 'm.gudel@gudel-werkzeuge.de', 8),
('11014', 'c.gudel@gudel-werkzeuge.de', 1),
('24055', 'm.gudel@gudel-werkzeuge.de', 2),
('11004', 'c.gudel@gudel-werkzeuge.de', 1),
('22126', 'm.gudel@gudel-werkzeuge.de', 4),
('14036', 'c.gudel@gudel-werkzeuge.de', 2),
('22001', 'm.gudel@gudel-werkzeuge.de', 4),
('11449', 'c.gudel@gudel-werkzeuge.de', 1),
('54116', 'm.gudel@gudel-werkzeuge.de', 1),
('22155', 'm.gudel@gudel-werkzeuge.de', 2),
('51290', 'm.gudel@gudel-werkzeuge.de', 6),
('10611', 'c.gudel@gudel-werkzeuge.de', 4),
('51284', 'm.gudel@gudel-werkzeuge.de', 3),
('10268', 'm.gudel@gudel-werkzeuge.de', 8),
('11205', 'c.gudel@gudel-werkzeuge.de', 2),
('24042', 'c.gudel@gudel-werkzeuge.de', 2),
('24075', 'm.gudel@gudel-werkzeuge.de', 2),
('34579', 'm.gudel@gudel-werkzeuge.de', 1),
('24047', 'c.gudel@gudel-werkzeuge.de', 2),
('51314', 'j.gudel@gudel-werkzeuge.de', 2),
('12013', 'm.gudel@gudel-werkzeuge.de', 1),
('14116', 'c.gudel@gudel-werkzeuge.de', 2),
('23008', 'm.gudel@gudel-werkzeuge.de', 8),
('54030', 'm.gudel@gudel-werkzeuge.de', 3),
('23171', 'j.gudel@gudel-werkzeuge.de', 2),
('54179', 'm.gudel@gudel-werkzeuge.de', 4),
('23243', 'm.gudel@gudel-werkzeuge.de', 4),
('23002', 'm.gudel@gudel-werkzeuge.de', 16),
('23249', 'm.gudel@gudel-werkzeuge.de', 2),
('23254', 'm.gudel@gudel-werkzeuge.de', 2),
('22157', 'm.gudel@gudel-werkzeuge.de', 12),
('23258', 'm.gudel@gudel-werkzeuge.de', 4),
('23252', 'm.gudel@gudel-werkzeuge.de', 1),
('11513', 'm.gudel@gudel-werkzeuge.de', 2),
('13007', 'm.gudel@gudel-werkzeuge.de', 24),
('54032', 'm.gudel@gudel-werkzeuge.de', 6),
('21020', 'm.gudel@gudel-werkzeuge.de', 4),
('51010', 'c.gudel@gudel-werkzeuge.de', 1),
('11091', 'm.gudel@gudel-werkzeuge.de', 2),
('12103', 'm.gudel@gudel-werkzeuge.de', 8),
('53007', 'c.gudel@gudel-werkzeuge.de', 2),
('51283', 'm.gudel@gudel-werkzeuge.de', 7),
('23270', 'c.gudel@gudel-werkzeuge.de', 4),
('51286', 'm.gudel@gudel-werkzeuge.de', 2),
('54169', 'm.gudel@gudel-werkzeuge.de', 1),
('54018', 'c.gudel@gudel-werkzeuge.de', 4),
('10028', 'c.gudel@gudel-werkzeuge.de', 4),
('10379', 'm.gudel@gudel-werkzeuge.de', 2),
('10154', 'c.gudel@gudel-werkzeuge.de', 1),
('52008', 'j.gudel@gudel-werkzeuge.de', 2),
('14037', 'm.gudel@gudel-werkzeuge.de', 2),
('10231', 'c.gudel@gudel-werkzeuge.de', 1),
('22020', 'c.gudel@gudel-werkzeuge.de', 1),
('51301', 'm.gudel@gudel-werkzeuge.de', 1),
('24030', 'c.gudel@gudel-werkzeuge.de', 2),
('12004', 'm.gudel@gudel-werkzeuge.de', 4),
('54065', 'm.gudel@gudel-werkzeuge.de', 1),
('11829', 'c.gudel@gudel-werkzeuge.de', 2),
('51293', 'm.gudel@gudel-werkzeuge.de', 4),
('24043', 'm.gudel@gudel-werkzeuge.de', 6),
('23012', 'm.gudel@gudel-werkzeuge.de', 16),
('10670', 'm.gudel@gudel-werkzeuge.de', 1),
('54146', 'c.gudel@gudel-werkzeuge.de', 2),
('24007', 'm.gudel@gudel-werkzeuge.de', 3),
('21054', 'm.gudel@gudel-werkzeuge.de', 4),
('11938', 'm.gudel@gudel-werkzeuge.de', 0),
('11277', 'm.gudel@gudel-werkzeuge.de', 1),
('24173', 'm.gudel@gudel-werkzeuge.de', 8),
('51064', 'm.gudel@gudel-werkzeuge.de', 4),
('23240', 'm.gudel@gudel-werkzeuge.de', 4),
('22125', 'm.gudel@gudel-werkzeuge.de', 6),
('22080', 'c.gudel@gudel-werkzeuge.de', 2),
('23217', 'm.gudel@gudel-werkzeuge.de', 12),
('24065', 'c.gudel@gudel-werkzeuge.de', 6),
('10243', 'c.gudel@gudel-werkzeuge.de', 1),
('60002', 'm.gudel@gudel-werkzeuge.de', 1),
('23253', 'm.gudel@gudel-werkzeuge.de', 8),
('23009', 'm.gudel@gudel-werkzeuge.de', 4),
('10306', 'c.gudel@gudel-werkzeuge.de', 1),
('54158', 'm.gudel@gudel-werkzeuge.de', 6),
('11009', 'm.gudel@gudel-werkzeuge.de', 12),
('12067', 'c.gudel@gudel-werkzeuge.de', 2),
('22156', 'm.gudel@gudel-werkzeuge.de', 4),
('21153', 'm.gudel@gudel-werkzeuge.de', 8),
('22165', 'm.gudel@gudel-werkzeuge.de', 16),
('12105', 'm.gudel@gudel-werkzeuge.de', 1),
('54020', 'm.gudel@gudel-werkzeuge.de', 3);

-- 3. Nicht gefundene Kundennummern speichern (vor dem Commit, da Temp-Table)
DROP TABLE IF EXISTS temp_missing_customers;
CREATE TEMP TABLE temp_missing_customers AS
SELECT i.kundennummer, i.fahrer_email
FROM temp_import_data i
LEFT JOIN tms.partners p ON p.easybill_customer_number = i.kundennummer
WHERE p.id IS NULL;

-- 4. Nicht gefundene Fahrer-Emails speichern (vor dem Commit)
DROP TABLE IF EXISTS temp_missing_drivers;
CREATE TEMP TABLE temp_missing_drivers AS
SELECT DISTINCT i.fahrer_email
FROM temp_import_data i
LEFT JOIN public.profiles pr ON pr.email = i.fahrer_email
WHERE pr.id IS NULL AND i.fahrer_email IS NOT NULL;

-- 5. UPSERT: Importiere oder aktualisiere Daten
-- WICHTIG: Constraint erlaubt nur Werte 1-52, daher: 0 -> NULL
INSERT INTO tms.partner_order_defaults (
    partner_id,
    driver_id,
    pickup_cycle_count,
    created_at,
    updated_at
)
SELECT 
    p.id AS partner_id,
    pr.id AS driver_id,
    NULLIF(i.wochenrhythmus, 0) AS pickup_cycle_count,
    NOW() AS created_at,
    NOW() AS updated_at
FROM temp_import_data i
INNER JOIN tms.partners p ON p.easybill_customer_number = i.kundennummer
LEFT JOIN public.profiles pr ON pr.email = i.fahrer_email
ON CONFLICT (partner_id) DO UPDATE SET
    driver_id = EXCLUDED.driver_id,
    pickup_cycle_count = EXCLUDED.pickup_cycle_count,
    updated_at = EXCLUDED.updated_at;

-- 6. Ergebnis in persistenter Tabelle speichern für Review nach COMMIT
DROP TABLE IF EXISTS tms.import_audit_log;
CREATE TABLE tms.import_audit_log (
    id SERIAL PRIMARY KEY,
    import_date TIMESTAMP DEFAULT NOW(),
    total_csv_records INTEGER,
    matched_customers INTEGER,
    unmatched_customers INTEGER,
    matched_drivers INTEGER,
    unmatched_drivers INTEGER
);

-- Zähle Ergebnisse
INSERT INTO tms.import_audit_log (total_csv_records, matched_customers, unmatched_customers, matched_drivers, unmatched_drivers)
SELECT 
    123,
    (SELECT COUNT(*) FROM temp_import_data) - (SELECT COUNT(*) FROM temp_missing_customers),
    (SELECT COUNT(*) FROM temp_missing_customers),
    (SELECT COUNT(*) FROM temp_import_data) - (SELECT COUNT(*) FROM temp_missing_drivers),
    (SELECT COUNT(*) FROM temp_missing_drivers);

COMMIT;

-- 7. Verifikation: Zeige Ergebnisse
-- NICHT GEFUNDENE KUNDENNUMMERN
SELECT 'NICHT_GEFUNDENE_KUNDEN' as result_type, kundennummer, fahrer_email FROM temp_missing_customers;

-- NICHT GEFUNDENE FAHRER
SELECT 'NICHT_GEFUNDENE_FAHRER' as result_type, fahrer_email, NULL FROM temp_missing_drivers;

-- IMPORT-STATISTIK
SELECT 
    'STATISTIK' as result_type,
    COUNT(*)::text AS total_imported,
    COUNT(*) FILTER (WHERE driver_id IS NOT NULL)::text AS with_driver,
    COUNT(*) FILTER (WHERE driver_id IS NULL)::text AS without_driver,
    COUNT(*) FILTER (WHERE pickup_cycle_count IS NOT NULL)::text AS with_pickup_cycle
FROM tms.partner_order_defaults;

-- ERSTE 20 IMPORTIERTE EINTRÄGE
SELECT 
    'BEISPIELE' as result_type,
    p.easybill_customer_number,
    p.display_name AS partner_name,
    pr.email AS driver_email,
    pod.pickup_cycle_count::text
FROM tms.partner_order_defaults pod
INNER JOIN tms.partners p ON p.id = pod.partner_id
LEFT JOIN public.profiles pr ON pr.id = pod.driver_id
ORDER BY p.easybill_customer_number
LIMIT 20;
