-- Zusätzliche Funktion: Hersteller mit Artikel-Anzahl laden
CREATE OR REPLACE FUNCTION tms.get_manufacturers_with_counts()
RETURNS TABLE (
    id UUID,
    name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    product_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.name,
        m.notes,
        m.created_at,
        m.updated_at,
        COUNT(p.id)::BIGINT AS product_count
    FROM tms.manufacturers m
    LEFT JOIN tms.products p ON p.manufacturer_id = m.id AND p.type = 'PRODUCT'
    GROUP BY m.id, m.name, m.notes, m.created_at, m.updated_at
    ORDER BY m.name;
END;
$$ LANGUAGE plpgsql;
