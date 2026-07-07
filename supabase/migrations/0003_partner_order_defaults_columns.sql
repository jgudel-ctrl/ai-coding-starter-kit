-- PROJ-17: Auftrags-Default — Erweiterung um Fahrer-Zuordnung und Abholzyklus
-- Beschreibung: Fügt driver_id (UUID → public.profiles) und pickup_cycle_count (Integer, Wochen) hinzu

-- 1) Neue Spalten in tms.partner_order_defaults
ALTER TABLE tms.partner_order_defaults
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_cycle_count INTEGER CHECK (pickup_cycle_count > 0 AND pickup_cycle_count <= 52);

-- 2) Index für Fahrer-Lookups
CREATE INDEX IF NOT EXISTS idx_partner_order_defaults_driver_id
  ON tms.partner_order_defaults(driver_id);

-- 3) Kommentare für Dokumentation
COMMENT ON COLUMN tms.partner_order_defaults.driver_id IS 'Verknüpfter Fahrer (nur User mit Rolle fahrer)';
COMMENT ON COLUMN tms.partner_order_defaults.pickup_cycle_count IS 'Abholzyklus in Wochen (1 = jede Woche, 2 = alle 2 Wochen)';
