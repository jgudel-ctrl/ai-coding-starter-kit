-- PROJ-28: Hersteller-Import Funktion
-- Baut Hersteller aus Easybill-Daten und verknüpft Artikel
-- Filtert Angebots-Notizen raus (nur echte Hersteller)

CREATE OR REPLACE FUNCTION tms.import_manufacturers_from_easybill()
RETURNS TABLE (
    manufacturers_created BIGINT,
    manufacturers_skipped BIGINT,
    products_linked BIGINT,
    products_without_manufacturer BIGINT
) AS $$
DECLARE
    v_created BIGINT := 0;
    v_skipped BIGINT := 0;
    v_linked BIGINT := 0;
    v_without BIGINT := 0;
    v_manufacturer_name TEXT;
    v_manufacturer_id UUID;
    v_product_count BIGINT;
BEGIN
    -- 1) Temp-Tabelle mit echten Hersteller-Namen (nicht Angebots-Notizen)
    -- Filter: max 3 Wörter, keine langen Texte, keine Sonderzeichen-Monster
    CREATE TEMP TABLE IF NOT EXISTS tmp_distinct_manufacturers ON COMMIT DROP AS
    SELECT DISTINCT TRIM(raw_easybill_payload->>'note') AS name
    FROM tms.products
    WHERE type = 'PRODUCT'
      AND raw_easybill_payload->>'note' IS NOT NULL
      AND raw_easybill_payload->>'note' <> ''
      AND LENGTH(TRIM(raw_easybill_payload->>'note')) <= 30
      AND TRIM(raw_easybill_payload->>'note') !~ '\d{4}-\d{2}-\d{2}'  -- kein Datum
      AND TRIM(raw_easybill_payload->>'note') !~ 'Angebot'           -- kein Angebot
      AND TRIM(raw_easybill_payload->>'note') !~ '€'                 -- kein Preis
      AND TRIM(raw_easybill_payload->>'note') !~ 'RE\d+'              -- keine Rechnungsnummer
      AND TRIM(raw_easybill_payload->>'note') !~ '\r'                -- keine Zeilenumbrüche
      AND TRIM(raw_easybill_payload->>'note') !~ 'vom \d'           -- kein "vom Datum"
      AND TRIM(raw_easybill_payload->>'note') !~ ':'                -- kein Doppelpunkt
      AND array_length(string_to_array(TRIM(raw_easybill_payload->>'note'), ' '), 1) <= 4;

    -- 2) Neue Hersteller anlegen (die noch nicht existieren)
    INSERT INTO tms.manufacturers (name)
    SELECT t.name
    FROM tmp_distinct_manufacturers t
    WHERE NOT EXISTS (
        SELECT 1 FROM tms.manufacturers m WHERE LOWER(m.name) = LOWER(t.name)
    );

    GET DIAGNOSTICS v_created = ROW_COUNT;

    -- 3) Gezählte Hersteller (inkl. existierende)
    SELECT COUNT(*) INTO v_skipped FROM tms.manufacturers;
    v_skipped := v_skipped - v_created;

    -- 4) Alle Hersteller in eine Map laden (Name -> ID)
    CREATE TEMP TABLE IF NOT EXISTS tmp_manufacturer_map ON COMMIT DROP AS
    SELECT id, LOWER(name) AS name_lower
    FROM tms.manufacturers;

    -- 5) Produkte verknüpfen (die noch keine manufacturer_id haben)
    UPDATE tms.products p
    SET manufacturer_id = m.id
    FROM tmp_manufacturer_map m
    WHERE p.type = 'PRODUCT'
      AND p.manufacturer_id IS NULL
      AND LOWER(TRIM(p.raw_easybill_payload->>'note')) = m.name_lower;

    GET DIAGNOSTICS v_linked = ROW_COUNT;

    -- 6) Artikel ohne Hersteller zählen
    SELECT COUNT(*) INTO v_without
    FROM tms.products
    WHERE type = 'PRODUCT'
      AND manufacturer_id IS NULL;

    -- Cleanup
    DROP TABLE IF EXISTS tmp_distinct_manufacturers;
    DROP TABLE IF EXISTS tmp_manufacturer_map;

    RETURN QUERY SELECT v_created, v_skipped, v_linked, v_without;
END;
$$ LANGUAGE plpgsql;
