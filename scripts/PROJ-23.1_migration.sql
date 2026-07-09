-- ============================================================
-- PROJ-23.1: Invoice-Sync via Easybill API
-- Datenbank-Migration: Tabellen neu aufsetzen
-- Erstellt: 2026-07-09
-- ============================================================

-- ============================================
-- SCHRITT 1: Alte Tabellen und Abhängigkeiten löschen
-- ============================================
DROP TABLE IF EXISTS tms.invoice_payments CASCADE;
DROP TABLE IF EXISTS tms.invoice_items CASCADE;
DROP TABLE IF EXISTS tms.invoice_sync_log CASCADE;
DROP TABLE IF EXISTS tms.invoices CASCADE;

-- ============================================
-- SCHRITT 2: Tabelle invoices
-- Alle Felder aus Easybill API Document-Resource
-- ============================================
CREATE TABLE tms.invoices (
    id BIGINT PRIMARY KEY,
    invoice_number TEXT NOT NULL,
    type TEXT NOT NULL,
    document_date DATE NOT NULL,
    due_date DATE,
    due_in_days INTEGER,
    status TEXT,
    is_draft BOOLEAN NOT NULL DEFAULT false,
    is_archive BOOLEAN NOT NULL DEFAULT false,

    -- Kunde
    customer_id BIGINT,
    partner_id UUID REFERENCES tms.partners(id) ON DELETE SET NULL,
    partner_name TEXT,
    contact_id BIGINT,

    -- Beträge (alle in Cent, wie Easybill)
    amount INTEGER NOT NULL DEFAULT 0,
    amount_net INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',

    -- Bezahlstatus (berechnet)
    payment_status TEXT NOT NULL DEFAULT 'open',
    paid_at DATE,

    -- Rabatt / Skonto
    discount TEXT,
    discount_type TEXT,
    cash_allowance NUMERIC(5,2),
    cash_allowance_days INTEGER,
    cash_allowance_text TEXT,

    -- MwSt.
    calc_vat_from INTEGER,
    vat_option TEXT,
    vat_country TEXT,
    vat_id TEXT,

    -- Referenzen
    cancel_id BIGINT,
    ref_id BIGINT,
    root_id BIGINT,
    order_number TEXT,
    buyer_reference TEXT,
    project_id BIGINT,
    external_id TEXT,

    -- Texte
    title TEXT,
    text TEXT,
    text_prefix TEXT,
    text_tax TEXT,

    -- Länder
    billing_country TEXT,
    shipping_country TEXT,
    fulfillment_country TEXT,

    -- Adressen (als JSONB)
    address JSONB,
    label_address JSONB,
    customer_snapshot JSONB,

    -- Zahlung / Verarbeitung
    payment_link_enabled BOOLEAN,
    payment_link_locale TEXT,
    use_shipping_address BOOLEAN,
    bank_debit_form TEXT,

    -- Sonstiges
    is_oss BOOLEAN DEFAULT false,
    is_replica BOOLEAN DEFAULT false,
    replica_url TEXT,
    pdf_template TEXT,
    pdf_pages INTEGER,
    login_id BIGINT,
    last_postbox_id BIGINT,
    contact_label TEXT,
    contact_text TEXT,

    -- Anonymisierung
    anonymize_status TEXT,
    anonymize_due_date DATE,
    anonymized_at TIMESTAMPTZ,
    is_acceptable_on_public_domain BOOLEAN,

    -- Arrays (als JSONB)
    item_notes JSONB,
    attachment_ids JSONB,
    advanced_data_fields JSONB,
    file_format_config JSONB,

    -- Leistungsdatum / Wiederholung
    service_date JSONB,
    recurring_options JSONB,

    -- Sync-Tracking
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL,
    edited_at TIMESTAMPTZ,

    -- Constraints
    CONSTRAINT uk_invoices_number UNIQUE (invoice_number)
);

-- Indizes für invoices
CREATE INDEX idx_invoices_partner_id ON tms.invoices(partner_id);
CREATE INDEX idx_invoices_document_date ON tms.invoices(document_date DESC);
CREATE INDEX idx_invoices_type ON tms.invoices(type);
CREATE INDEX idx_invoices_payment_status ON tms.invoices(payment_status);
CREATE INDEX idx_invoices_customer_id ON tms.invoices(customer_id);
CREATE INDEX idx_invoices_last_synced ON tms.invoices(last_synced_at DESC);

-- ============================================
-- SCHRITT 3: Tabelle invoice_items
-- Alle Felder aus Easybill API DocumentPosition-Resource
-- ============================================
CREATE TABLE tms.invoice_items (
    id BIGINT PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES tms.invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 1,

    -- Positionstyp
    type TEXT,
    item_type TEXT,

    -- Artikel
    article_number TEXT,
    description TEXT NOT NULL DEFAULT '',
    document_note TEXT,
    internal_note TEXT,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    quantity_str TEXT,
    unit TEXT,

    -- Preise (alle in Cent)
    single_price_net INTEGER NOT NULL DEFAULT 0,
    single_price_gross INTEGER NOT NULL DEFAULT 0,
    total_price_net INTEGER NOT NULL DEFAULT 0,
    total_price_gross INTEGER NOT NULL DEFAULT 0,
    total_vat INTEGER NOT NULL DEFAULT 0,
    vat_percent NUMERIC(5,2),

    -- Rabatt
    discount NUMERIC(10,2),
    discount_type TEXT,

    -- Kosten
    cost_price_net INTEGER,
    cost_price_total INTEGER,
    cost_price_charge NUMERIC(10,2),
    cost_price_charge_type TEXT,

    -- Referenzen
    position_id BIGINT,
    booking_account TEXT,
    export_cost_1 TEXT,
    export_cost_2 TEXT,
    serial_number TEXT,
    serial_number_id TEXT,

    -- Sync-Tracking
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uk_invoice_items_position UNIQUE (invoice_id, position)
);

-- Indizes für invoice_items
CREATE INDEX idx_invoice_items_invoice_id ON tms.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_article_number ON tms.invoice_items(article_number);
CREATE INDEX idx_invoice_items_item_type ON tms.invoice_items(item_type);

-- ============================================
-- SCHRITT 4: Tabelle invoice_payments
-- Alle Felder aus Easybill API DocumentPayment-Resource
-- ============================================
CREATE TABLE tms.invoice_payments (
    id BIGINT PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES tms.invoices(id) ON DELETE CASCADE,

    amount INTEGER NOT NULL DEFAULT 0,
    payment_at DATE,
    payment_type TEXT,
    provider TEXT,
    reference TEXT,
    notice TEXT,
    is_overdue_fee BOOLEAN DEFAULT false,
    login_id BIGINT,

    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indizes für invoice_payments
CREATE INDEX idx_invoice_payments_invoice_id ON tms.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_at ON tms.invoice_payments(payment_at DESC);

-- ============================================
-- SCHRITT 5: Tabelle invoice_sync_log
-- Tracking für Cronjob und manuelle Syncs
-- ============================================
CREATE TABLE tms.invoice_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    documents_fetched INTEGER NOT NULL DEFAULT 0,
    documents_inserted INTEGER NOT NULL DEFAULT 0,
    documents_updated INTEGER NOT NULL DEFAULT 0,
    items_inserted INTEGER NOT NULL DEFAULT 0,
    payments_inserted INTEGER NOT NULL DEFAULT 0,
    errors TEXT,
    error_message TEXT,
    performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indizes für invoice_sync_log
CREATE INDEX idx_sync_log_started_at ON tms.invoice_sync_log(started_at DESC);
CREATE INDEX idx_sync_log_status ON tms.invoice_sync_log(status);

-- ============================================
-- SCHRITT 6: Row Level Security (RLS)
-- Lesen: Alle eingeloggten User
-- Schreiben: Nur Admin
-- ============================================

-- --- invoices ---
ALTER TABLE tms.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_all ON tms.invoices
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoices_insert_admin ON tms.invoices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoices_update_admin ON tms.invoices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoices_delete_admin ON tms.invoices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- invoice_items ---
ALTER TABLE tms.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_select_all ON tms.invoice_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoice_items_insert_admin ON tms.invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_items_update_admin ON tms.invoice_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_items_delete_admin ON tms.invoice_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- invoice_payments ---
ALTER TABLE tms.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_payments_select_all ON tms.invoice_payments
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoice_payments_insert_admin ON tms.invoice_payments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_payments_update_admin ON tms.invoice_payments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_payments_delete_admin ON tms.invoice_payments
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- --- invoice_sync_log ---
ALTER TABLE tms.invoice_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_log_select_all ON tms.invoice_sync_log
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY sync_log_insert_admin ON tms.invoice_sync_log
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY sync_log_update_admin ON tms.invoice_sync_log
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- SCHRITT 7: Kommentare für Dokumentation
-- ============================================

COMMENT ON TABLE tms.invoices IS 'Rechnungen aus Easybill (Documents vom Typ INVOICE, CREDIT, STORNO, STORNO_CREDIT)';
COMMENT ON TABLE tms.invoice_items IS 'Rechnungspositionen aus Easybill (DocumentPosition)';
COMMENT ON TABLE tms.invoice_payments IS 'Zahlungen zu Rechnungen aus Easybill (DocumentPayment)';
COMMENT ON TABLE tms.invoice_sync_log IS 'Log für Invoice-Sync (manuell und Cronjob)';
