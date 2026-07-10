-- PROJ-24: Geoapify Adressvalidierung
-- Fügt Spalten zur partner_addresses Tabelle hinzu

ALTER TABLE tms.partner_addresses
ADD COLUMN IF NOT EXISTS geoapify_confidence NUMERIC(3,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geoapify_suggested_street TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geoapify_suggested_postal_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geoapify_suggested_city TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geoapify_suggested_country TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geoapify_validated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS geoapify_status TEXT DEFAULT NULL CHECK (geoapify_status IN ('valid', 'suggestion', 'invalid', 'error'));

-- Index für schnelle Abfrage: Welche Adressen müssen noch validiert werden?
CREATE INDEX IF NOT EXISTS idx_partner_addresses_geoapify_status 
ON tms.partner_addresses(geoapify_status) 
WHERE geoapify_status IS NULL;
