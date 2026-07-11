-- PROJ-28: Hersteller-Verwaltung & Artikel-Zuordnung
-- Erstellt: 2026-07-11
-- 1) Hersteller-Stammdaten-Tabelle
-- 2) Fremdschlüssel manufacturer_id in tms.products
-- 3) RLS-Richtlinien für manufacturers
-- 4) Funktion zur Artikel-Anzahl pro Hersteller

-- ============================================
-- 1) Hersteller-Tabelle
-- ============================================
CREATE TABLE IF NOT EXISTS tms.manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT manufacturers_name_unique UNIQUE (name)
);

-- Index für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_manufacturers_name ON tms.manufacturers(name);

-- ============================================
-- 2) manufacturer_id in tms.products
-- ============================================
ALTER TABLE tms.products
ADD COLUMN IF NOT EXISTS manufacturer_id UUID
    REFERENCES tms.manufacturers(id)
    ON DELETE SET NULL;

-- Index für schnelle Filterung nach Hersteller
CREATE INDEX IF NOT EXISTS idx_products_manufacturer_id ON tms.products(manufacturer_id);

-- ============================================
-- 3) RLS für manufacturers
-- ============================================
ALTER TABLE tms.manufacturers ENABLE ROW LEVEL SECURITY;

-- Jeder eingeloggte Nutzer darf Hersteller lesen
DROP POLICY IF EXISTS "Hersteller lesen — alle Nutzer" ON tms.manufacturers;
CREATE POLICY "Hersteller lesen — alle Nutzer"
    ON tms.manufacturers
    FOR SELECT
    TO authenticated
    USING (true);

-- Nur Admin darf Hersteller anlegen/bearbeiten/löschen
DROP POLICY IF EXISTS "Hersteller schreiben — nur Admin" ON tms.manufacturers;
CREATE POLICY "Hersteller schreiben — nur Admin"
    ON tms.manufacturers
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND 'admin'::user_role = ANY(roles)
            AND status = 'aktiv'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND 'admin'::user_role = ANY(roles)
            AND status = 'aktiv'
        )
    );

-- ============================================
-- 4) Funktion: Artikel-Anzahl pro Hersteller
-- ============================================
CREATE OR REPLACE FUNCTION tms.get_manufacturer_product_count(p_manufacturer_id UUID)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*) 
        FROM tms.products 
        WHERE manufacturer_id = p_manufacturer_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 5) Trigger: updated_at automatisch setzen
-- ============================================
CREATE OR REPLACE FUNCTION tms.update_manufacturer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_manufacturers_updated_at ON tms.manufacturers;
CREATE TRIGGER trg_manufacturers_updated_at
    BEFORE UPDATE ON tms.manufacturers
    FOR EACH ROW
    EXECUTE FUNCTION tms.update_manufacturer_updated_at();
