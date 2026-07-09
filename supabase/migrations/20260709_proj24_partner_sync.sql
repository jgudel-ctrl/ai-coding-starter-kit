-- Migration: PROJ-24 Easybill Partner-Sync (Rabatte, Dubletten, Soft-Delete)
-- Erstellt: 2026-07-09
-- Beschreibung: Neue Tabellen für Rabatte/Produktgruppen + Erweiterungen bestehender Tabellen

-- ============================================================
-- 1. Neue Tabellen
-- ============================================================

-- Position Groups (Produktgruppen) — Referenz-Tabelle
CREATE TABLE IF NOT EXISTS tms.position_groups (
  id BIGINT PRIMARY KEY, -- Easybill ID als PK
  name TEXT,
  display_name TEXT,
  number TEXT,
  description TEXT,
  raw_easybill_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_position_groups_number ON tms.position_groups(number);
CREATE INDEX IF NOT EXISTS idx_position_groups_name ON tms.position_groups(name);

-- Customer Groups (Kundengruppen) — Referenz-Tabelle
CREATE TABLE IF NOT EXISTS tms.customer_groups (
  id BIGINT PRIMARY KEY, -- Easybill ID als PK
  name TEXT,
  display_name TEXT,
  number TEXT,
  description TEXT,
  raw_easybill_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_groups_number ON tms.customer_groups(number);
CREATE INDEX IF NOT EXISTS idx_customer_groups_name ON tms.customer_groups(name);

-- Partner Discounts (Kunden-Rabatte pro Produktgruppe)
CREATE TABLE IF NOT EXISTS tms.partner_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES tms.partners(id) ON DELETE CASCADE,
  easybill_discount_id BIGINT,
  position_group_id BIGINT NOT NULL REFERENCES tms.position_groups(id) ON DELETE CASCADE,
  position_group_name TEXT,
  position_group_number TEXT,
  discount_percent NUMERIC(5,2),
  discount_type TEXT DEFAULT 'PERCENT', -- 'PERCENT' oder 'AMOUNT'
  raw_easybill_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(partner_id, position_group_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_discounts_partner ON tms.partner_discounts(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_discounts_group ON tms.partner_discounts(position_group_id);
CREATE INDEX IF NOT EXISTS idx_partner_discounts_number ON tms.partner_discounts(position_group_number);

-- ============================================================
-- 2. Erweiterungen bestehender Tabellen
-- ============================================================

-- Partners: Dubletten-Felder
ALTER TABLE tms.partners 
ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES tms.partners(id),
ADD COLUMN IF NOT EXISTS duplicate_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_partners_duplicate ON tms.partners(duplicate_of) WHERE duplicate_of IS NOT NULL;

-- Partner Addresses: Soft-Delete + is_primary
ALTER TABLE tms.partner_addresses 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Partner Contacts: Soft-Delete
ALTER TABLE tms.partner_contacts 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- 3. RLS-Policies (wichtig für Supabase!)
-- ============================================================

-- Position Groups: Alle lesen, nur service_role schreiben
ALTER TABLE tms.position_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "position_groups_select_all" ON tms.position_groups
  FOR SELECT USING (true);

CREATE POLICY "position_groups_admin_write" ON tms.position_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tms.user_roles ur
      JOIN tms.users u ON ur.user_id = u.id
      WHERE u.auth_user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Customer Groups: Alle lesen, nur service_role schreiben
ALTER TABLE tms.customer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_groups_select_all" ON tms.customer_groups
  FOR SELECT USING (true);

CREATE POLICY "customer_groups_admin_write" ON tms.customer_groups
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tms.user_roles ur
      JOIN tms.users u ON ur.user_id = u.id
      WHERE u.auth_user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Partner Discounts: Nur Admin/Sales lesen/schreiben
ALTER TABLE tms.partner_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_discounts_select_all" ON tms.partner_discounts
  FOR SELECT USING (true);

CREATE POLICY "partner_discounts_admin_write" ON tms.partner_discounts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tms.user_roles ur
      JOIN tms.users u ON ur.user_id = u.id
      WHERE u.auth_user_id = auth.uid() AND ur.role IN ('admin', 'sales')
    )
  );

-- ============================================================
-- 4. Kommentare
-- ============================================================

COMMENT ON TABLE tms.position_groups IS 'Produktgruppen aus Easybill (W10, W11, etc.)';
COMMENT ON TABLE tms.customer_groups IS 'Kundengruppen aus Easybill (KD0, KD1, etc.)';
COMMENT ON TABLE tms.partner_discounts IS 'Kunden-spezifische Rabatte pro Produktgruppe';

-- ============================================================
-- 5. Verification
-- ============================================================

SELECT 'Migration PROJ-24 erfolgreich abgeschlossen' AS status;
