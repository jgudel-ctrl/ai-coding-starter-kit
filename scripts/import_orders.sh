#!/bin/bash
# Import-Script für Aufträge aus CSV
# PROJ-19 - Auftragsverwaltung

# Pfad zur CSV-Datei
CSV_FILE="/tmp/orders_import.csv"

# Prüfe ob Datei existiert
if [ ! -f "$CSV_FILE" ]; then
    echo "❌ Datei nicht gefunden: $CSV_FILE"
    exit 1
fi

# Temporäres SQL-Script erstellen
SQL_FILE="/tmp/import_orders_run.sql"

cat > "$SQL_FILE" << 'EOF'
-- Temporäre Tabelle erstellen
DROP TABLE IF EXISTS temp_orders_import;
CREATE TEMP TABLE temp_orders_import (
    kundennummer TEXT,
    datum DATE,
    status TEXT
);

-- CSV laden via stdin (wird von außen per \copy eingespielt)
\COPY temp_orders_import FROM '/tmp/orders_import.csv' WITH (FORMAT csv, HEADER true, DELIMITER ';');

-- Prüfe Daten
SELECT 'Status-Verteilung:' as info;
SELECT status, COUNT(*) FROM temp_orders_import GROUP BY status ORDER BY COUNT(*) DESC;

-- Hole Admin-User ID und führe Import durch
DO $$
DECLARE
    admin_user_id UUID;
    inserted_count INTEGER := 0;
BEGIN
    SELECT id INTO admin_user_id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'Kein Admin-User gefunden!';
    END IF;
    
    -- Importiere Daten
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
        CASE WHEN ti.status = 'Werkzeuge abholen' THEN ti.datum ELSE NULL END as geplantes_abholdatum,
        CASE WHEN ti.status != 'Werkzeuge abholen' THEN ti.datum ELSE NULL END as tatsaechliches_abholdatum,
        COALESCE(pod.inbound_type, 'Bringen') as zugang,
        COALESCE(pod.outbound_type, 'Lieferung') as ruecksendung,
        pod.driver_id as fahrer_id,
        pod.pickup_cycle_count as abholzyklus_wochen,
        COALESCE(pod.pickup_delivery_status = 'Automatisch', false) as abholservice,
        admin_user_id as erstellt_von,
        'Migration aus Alt-System' as titel;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE '✅ % Aufträge importiert!', inserted_count;
    
END $$;

-- Verifizierung
SELECT ''::text as info;
SELECT 'Status-Verteilung in DB:' as info;
SELECT status, COUNT(*) as anzahl FROM tms.orders GROUP BY status ORDER BY anzahl DESC;

SELECT ''::text as info;
SELECT 'Beispiele:' as info;
SELECT p.company_name, o.status, o.geplantes_abholdatum, o.tatsaechliches_abholdatum, o.zugang
FROM tms.orders o
JOIN tms.partners p ON p.id = o.partner_id
LIMIT 10;

-- Cleanup
DROP TABLE IF EXISTS temp_orders_import;
EOF

# Führe SQL aus
echo "🚀 Starte Import..."
cd /home/botti/projects/supabase-selfhosted && docker compose exec -T db psql -U postgres -d postgres -f /tmp/import_orders_run.sql

echo ""
echo "🎉 Import abgeschlossen!"
