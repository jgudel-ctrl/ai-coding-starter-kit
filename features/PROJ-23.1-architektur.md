# PROJ-23.1 — Architektur: Invoice-Sync via Easybill API

**Status:** 🟠 In Review  
**Erstellt:** 2026-07-09  
**Scope:** Datenbank-Neuaufbau + Easybill API-Sync + Bezahlstatus + Admin-UI

---

## Zusammenfassung

Kompletter Neuaufbau der Invoice-Daten (`invoices`, `invoice_items`, `invoice_payments`, `invoice_sync_log`) mit automatischer Synchronisation aus der Easybill REST API. Alle Rechnungen, Positionen und Zahlungen ab 01.01.2023 werden täglich (02:00 Uhr) abgerufen und in der Datenbank gespeichert. Bezahlstatus wird berechnet, Kunden werden via `easybill_customer_number` verknüpft.

---

## 1. Datenbank-Schema

### 1.1 Tabellen-Löschung und Neuaufbau

```sql
-- ============================================
-- SCHRITT 1: Alte Tabellen und Constraints löschen
-- ============================================
DROP TABLE IF EXISTS tms.invoice_payments CASCADE;
DROP TABLE IF EXISTS tms.invoice_items CASCADE;
DROP TABLE IF EXISTS tms.invoice_sync_log CASCADE;
DROP TABLE IF EXISTS tms.invoices CASCADE;

-- ============================================
-- SCHRITT 2: Tabelle invoices
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

    customer_id BIGINT,
    partner_id UUID REFERENCES tms.partners(id) ON DELETE SET NULL,
    partner_name TEXT,
    contact_id BIGINT,

    amount INTEGER NOT NULL DEFAULT 0,
    amount_net INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',

    payment_status TEXT NOT NULL DEFAULT 'open',
    paid_at DATE,

    discount TEXT,
    discount_type TEXT,
    cash_allowance NUMERIC(5,2),
    cash_allowance_days INTEGER,
    cash_allowance_text TEXT,

    calc_vat_from INTEGER,
    vat_option TEXT,
    vat_country TEXT,
    vat_id TEXT,

    cancel_id BIGINT,
    ref_id BIGINT,
    root_id BIGINT,
    order_number TEXT,
    buyer_reference TEXT,
    project_id BIGINT,
    external_id TEXT,

    title TEXT,
    text TEXT,
    text_prefix TEXT,
    text_tax TEXT,

    billing_country TEXT,
    shipping_country TEXT,
    fulfillment_country TEXT,

    address JSONB,
    label_address JSONB,
    customer_snapshot JSONB,

    payment_link_enabled BOOLEAN,
    payment_link_locale TEXT,
    use_shipping_address BOOLEAN,
    bank_debit_form TEXT,

    is_oss BOOLEAN DEFAULT false,
    is_replica BOOLEAN DEFAULT false,
    replica_url TEXT,
    pdf_template TEXT,
    pdf_pages INTEGER,
    login_id BIGINT,
    last_postbox_id BIGINT,
    contact_label TEXT,
    contact_text TEXT,

    anonymize_status TEXT,
    anonymize_due_date DATE,
    anonymized_at TIMESTAMPTZ,
    is_acceptable_on_public_domain BOOLEAN,

    item_notes JSONB,
    attachment_ids JSONB,
    advanced_data_fields JSONB,
    file_format_config JSONB,

    service_date JSONB,
    recurring_options JSONB,

    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL,
    edited_at TIMESTAMPTZ,

    CONSTRAINT uk_invoices_number UNIQUE (invoice_number)
);

CREATE INDEX idx_invoices_partner_id ON tms.invoices(partner_id);
CREATE INDEX idx_invoices_document_date ON tms.invoices(document_date DESC);
CREATE INDEX idx_invoices_type ON tms.invoices(type);
CREATE INDEX idx_invoices_payment_status ON tms.invoices(payment_status);
CREATE INDEX idx_invoices_customer_id ON tms.invoices(customer_id);
CREATE INDEX idx_invoices_last_synced ON tms.invoices(last_synced_at DESC);

-- ============================================
-- SCHRITT 3: Tabelle invoice_items
-- ============================================
CREATE TABLE tms.invoice_items (
    id BIGINT PRIMARY KEY,
    invoice_id BIGINT NOT NULL REFERENCES tms.invoices(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 1,

    type TEXT,
    item_type TEXT,

    article_number TEXT,
    description TEXT NOT NULL DEFAULT '',
    document_note TEXT,
    internal_note TEXT,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
    quantity_str TEXT,
    unit TEXT,

    single_price_net INTEGER NOT NULL DEFAULT 0,
    single_price_gross INTEGER NOT NULL DEFAULT 0,
    total_price_net INTEGER NOT NULL DEFAULT 0,
    total_price_gross INTEGER NOT NULL DEFAULT 0,
    total_vat INTEGER NOT NULL DEFAULT 0,
    vat_percent NUMERIC(5,2),

    discount NUMERIC(10,2),
    discount_type TEXT,

    cost_price_net INTEGER,
    cost_price_total INTEGER,
    cost_price_charge NUMERIC(10,2),
    cost_price_charge_type TEXT,

    position_id BIGINT,
    booking_account TEXT,
    export_cost_1 TEXT,
    export_cost_2 TEXT,
    serial_number TEXT,
    serial_number_id TEXT,

    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uk_invoice_items_position UNIQUE (invoice_id, position)
);

CREATE INDEX idx_invoice_items_invoice_id ON tms.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_article_number ON tms.invoice_items(article_number);
CREATE INDEX idx_invoice_items_item_type ON tms.invoice_items(item_type);

-- ============================================
-- SCHRITT 4: Tabelle invoice_payments
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

CREATE INDEX idx_invoice_payments_invoice_id ON tms.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_at ON tms.invoice_payments(payment_at DESC);

-- ============================================
-- SCHRITT 5: Tabelle invoice_sync_log
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

CREATE INDEX idx_sync_log_started_at ON tms.invoice_sync_log(started_at DESC);
CREATE INDEX idx_sync_log_status ON tms.invoice_sync_log(status);
```

### 1.2 RLS (Row Level Security)

```sql
-- ============================================
-- INVOICES
-- ============================================
ALTER TABLE tms.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_policy ON tms.invoices
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoices_insert_admin_policy ON tms.invoices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoices_update_admin_policy ON tms.invoices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoices_delete_admin_policy ON tms.invoices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- INVOICE_ITEMS
-- ============================================
ALTER TABLE tms.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_select_policy ON tms.invoice_items
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoice_items_insert_admin_policy ON tms.invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_items_update_admin_policy ON tms.invoice_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_items_delete_admin_policy ON tms.invoice_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- INVOICE_PAYMENTS
-- ============================================
ALTER TABLE tms.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_payments_select_policy ON tms.invoice_payments
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY invoice_payments_insert_admin_policy ON tms.invoice_payments
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_payments_update_admin_policy ON tms.invoice_payments
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY invoice_payments_delete_admin_policy ON tms.invoice_payments
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================
-- INVOICE_SYNC_LOG
-- ============================================
ALTER TABLE tms.invoice_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_log_select_policy ON tms.invoice_sync_log
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY sync_log_insert_admin_policy ON tms.invoice_sync_log
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY sync_log_update_admin_policy ON tms.invoice_sync_log
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin')
    );
```

---

## 2. Easybill API-Client

### 2.1 Basis-Client

```typescript
// src/lib/easybill/client.ts

const EASYBILL_BASE_URL = "https://api.easybill.de/rest/v1";
const API_KEY = process.env.EASYBILL_API_KEY;

interface EasybillDocument {
  id: number;
  number: string;
  type: string;
  document_date: string;
  due_date: string | null;
  due_in_days: number | null;
  status: string | null;
  is_draft: boolean;
  is_archive: boolean;
  customer_id: number | null;
  contact_id: number | null;
  amount: number;
  amount_net: number;
  paid_amount: number;
  currency: string;
  paid_at: string | null;
  discount: string | null;
  discount_type: string | null;
  cash_allowance: number | null;
  cash_allowance_days: number | null;
  cash_allowance_text: string | null;
  calc_vat_from: number | null;
  vat_option: string | null;
  vat_country: string | null;
  vat_id: string | null;
  cancel_id: number | null;
  ref_id: number | null;
  root_id: number | null;
  order_number: string | null;
  buyer_reference: string | null;
  project_id: number | null;
  external_id: string | null;
  title: string | null;
  text: string | null;
  text_prefix: string | null;
  text_tax: string | null;
  billing_country: string | null;
  shipping_country: string | null;
  fulfillment_country: string | null;
  address: any | null;
  label_address: any | null;
  customer_snapshot: any | null;
  payment_link_enabled: boolean | null;
  payment_link_locale: string | null;
  use_shipping_address: boolean | null;
  bank_debit_form: string | null;
  is_oss: boolean;
  is_replica: boolean;
  replica_url: string | null;
  pdf_template: string | null;
  pdf_pages: number | null;
  login_id: number | null;
  last_postbox_id: number | null;
  contact_label: string | null;
  contact_text: string | null;
  anonymize_status: string | null;
  anonymize_due_date: string | null;
  anonymized_at: string | null;
  is_acceptable_on_public_domain: boolean | null;
  item_notes: any[] | null;
  attachment_ids: number[] | null;
  advanced_data_fields: any[] | null;
  file_format_config: any[] | null;
  service_date: any | null;
  recurring_options: any | null;
  created_at: string;
  edited_at: string | null;
  items?: EasybillDocumentPosition[];
}

interface EasybillDocumentPosition {
  id: number;
  document_id: number;
  position: number;
  type: string | null;
  itemType: string | null;
  number: string | null;
  description: string;
  document_note: string | null;
  note: string | null;
  quantity: number;
  quantity_str: string | null;
  unit: string | null;
  single_price_net: number;
  single_price_gross: number;
  total_price_net: number;
  total_price_gross: number;
  total_vat: number;
  vat_percent: number;
  discount: number | null;
  discount_type: string | null;
  cost_price_net: number | null;
  cost_price_total: number | null;
  cost_price_charge: number | null;
  cost_price_charge_type: string | null;
  position_id: number | null;
  booking_account: string | null;
  export_cost_1: string | null;
  export_cost_2: string | null;
  serial_number: string | null;
  serial_number_id: string | null;
}

interface EasybillDocumentPayment {
  id: number;
  document_id: number;
  amount: number;
  payment_at: string | null;
  type: string | null;
  provider: string | null;
  reference: string | null;
  notice: string | null;
  is_overdue_fee: boolean;
  login_id: number | null;
}

async function easybillFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${EASYBILL_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (response.status === 429) {
    // Rate limit — warten und retry
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return easybillFetch(endpoint, options);
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Easybill API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// ============================================
// API-Funktionen
// ============================================

export async function fetchDocumentsPage(
  page: number = 1,
  limit: number = 1000,
  editedAfter?: string
): Promise<{ items: EasybillDocument[]; page: number; pages: number }> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("page", String(page));
  params.set("is_draft", "false");
  params.set(
    "type",
    "INVOICE,CREDIT,STORNO,STORNO_CREDIT"
  );
  if (editedAfter) {
    params.set("edited_at", `${editedAfter},9999-12-31`);
  }

  return easybillFetch<{ items: EasybillDocument[]; page: number; pages: number }>(
    `/documents?${params.toString()}`
  );
}

export async function fetchDocumentItems(
  documentId: number
): Promise<EasybillDocumentPosition[]> {
  const result = await easybillFetch<{ items: EasybillDocumentPosition[] }>(
    `/documents/${documentId}/items`
  );
  return result.items || [];
}

export async function fetchDocumentPayments(
  documentId: number
): Promise<EasybillDocumentPayment[]> {
  const result = await easybillFetch<{ items: EasybillDocumentPayment[] }>(
    `/documents/${documentId}/payments`
  );
  return result.items || [];
}

export async function fetchDocumentById(
  documentId: number
): Promise<EasybillDocument> {
  return easybillFetch<EasybillDocument>(`/documents/${documentId}`);
}
```

---

## 3. Sync-Logik

### 3.1 Sync-Service

```typescript
// src/lib/easybill/sync.ts

import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchDocumentsPage,
  fetchDocumentItems,
  fetchDocumentPayments,
} from "./client";

export type PaymentStatus = "paid" | "partial" | "open" | "overdue";

function calculatePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  dueDate: string | null
): PaymentStatus {
  if (paidAmount >= totalAmount) return "paid";
  if (paidAmount > 0) return "partial";
  if (dueDate && new Date(dueDate) < new Date()) return "overdue";
  return "open";
}

export interface SyncResult {
  documentsFetched: number;
  documentsInserted: number;
  documentsUpdated: number;
  itemsInserted: number;
  paymentsInserted: number;
  errors: string[];
}

/**
 * Einzelnes Dokument in die Datenbank speichern (INSERT oder UPDATE)
 */
async function syncDocument(
  doc: any,
  partnerMap: Map<number, string> // easybill_customer_number → partner_id
): Promise<{ items: number; payments: number; error?: string }> {
  const admin = createAdminClient({ schema: "tms" });

  try {
    // Partner verknüpfen
    const partnerId = doc.customer_id
      ? partnerMap.get(doc.customer_id) || null
      : null;

    // Bezahlstatus berechnen
    const paymentStatus = calculatePaymentStatus(
      doc.paid_amount || 0,
      doc.amount || 0,
      doc.due_date
    );

    // Invoice INSERT/UPDATE
    const invoiceData = {
      id: doc.id,
      invoice_number: doc.number,
      type: doc.type,
      document_date: doc.document_date,
      due_date: doc.due_date,
      due_in_days: doc.due_in_days,
      status: doc.status,
      is_draft: doc.is_draft,
      is_archive: doc.is_archive,
      customer_id: doc.customer_id,
      partner_id: partnerId,
      partner_name: doc.address?.company_name || doc.address?.last_name || null,
      contact_id: doc.contact_id,
      amount: doc.amount,
      amount_net: doc.amount_net,
      paid_amount: doc.paid_amount,
      currency: doc.currency,
      payment_status: paymentStatus,
      paid_at: doc.paid_at,
      discount: doc.discount,
      discount_type: doc.discount_type,
      cash_allowance: doc.cash_allowance,
      cash_allowance_days: doc.cash_allowance_days,
      cash_allowance_text: doc.cash_allowance_text,
      calc_vat_from: doc.calc_vat_from,
      vat_option: doc.vat_option,
      vat_country: doc.vat_country,
      vat_id: doc.vat_id,
      cancel_id: doc.cancel_id,
      ref_id: doc.ref_id,
      root_id: doc.root_id,
      order_number: doc.order_number,
      buyer_reference: doc.buyer_reference,
      project_id: doc.project_id,
      external_id: doc.external_id,
      title: doc.title,
      text: doc.text,
      text_prefix: doc.text_prefix,
      text_tax: doc.text_tax,
      billing_country: doc.billing_country,
      shipping_country: doc.shipping_country,
      fulfillment_country: doc.fulfillment_country,
      address: doc.address,
      label_address: doc.label_address,
      customer_snapshot: doc.customer_snapshot,
      payment_link_enabled: doc.payment_link_enabled,
      payment_link_locale: doc.payment_link_locale,
      use_shipping_address: doc.use_shipping_address,
      bank_debit_form: doc.bank_debit_form,
      is_oss: doc.is_oss,
      is_replica: doc.is_replica,
      replica_url: doc.replica_url,
      pdf_template: doc.pdf_template,
      pdf_pages: doc.pdf_pages,
      login_id: doc.login_id,
      last_postbox_id: doc.last_postbox_id,
      contact_label: doc.contact_label,
      contact_text: doc.contact_text,
      anonymize_status: doc.anonymize_status,
      anonymize_due_date: doc.anonymize_due_date,
      anonymized_at: doc.anonymized_at,
      is_acceptable_on_public_domain: doc.is_acceptable_on_public_domain,
      item_notes: doc.item_notes,
      attachment_ids: doc.attachment_ids,
      advanced_data_fields: doc.advanced_data_fields,
      file_format_config: doc.file_format_config,
      service_date: doc.service_date,
      recurring_options: doc.recurring_options,
      last_synced_at: new Date().toISOString(),
      created_at: doc.created_at,
      edited_at: doc.edited_at,
    };

    const { error: upsertError } = await admin
      .from("invoices")
      .upsert(invoiceData, { onConflict: "id" });

    if (upsertError) throw upsertError;

    // Positionen abrufen und speichern
    let itemsInserted = 0;
    try {
      const items = await fetchDocumentItems(doc.id);
      if (items.length > 0) {
        const itemsData = items.map((item: any) => ({
          id: item.id,
          invoice_id: doc.id,
          position: item.position,
          type: item.type,
          item_type: item.itemType,
          article_number: item.number,
          description: item.description,
          document_note: item.document_note,
          internal_note: item.note,
          quantity: item.quantity,
          quantity_str: item.quantity_str,
          unit: item.unit,
          single_price_net: item.single_price_net,
          single_price_gross: item.single_price_gross,
          total_price_net: item.total_price_net,
          total_price_gross: item.total_price_gross,
          total_vat: item.total_vat,
          vat_percent: item.vat_percent,
          discount: item.discount,
          discount_type: item.discount_type,
          cost_price_net: item.cost_price_net,
          cost_price_total: item.cost_price_total,
          cost_price_charge: item.cost_price_charge,
          cost_price_charge_type: item.cost_price_charge_type,
          position_id: item.position_id,
          booking_account: item.booking_account,
          export_cost_1: item.export_cost_1,
          export_cost_2: item.export_cost_2,
          serial_number: item.serial_number,
          serial_number_id: item.serial_number_id,
          last_synced_at: new Date().toISOString(),
        }));

        const { error: itemsError } = await admin
          .from("invoice_items")
          .upsert(itemsData, { onConflict: "id" });

        if (itemsError) throw itemsError;
        itemsInserted = itemsData.length;
      }
    } catch (e) {
      console.error(`[Sync] Error fetching items for document ${doc.id}:`, e);
    }

    // Zahlungen abrufen und speichern
    let paymentsInserted = 0;
    try {
      const payments = await fetchDocumentPayments(doc.id);
      if (payments.length > 0) {
        const paymentsData = payments.map((p: any) => ({
          id: p.id,
          invoice_id: doc.id,
          amount: p.amount,
          payment_at: p.payment_at,
          payment_type: p.type,
          provider: p.provider,
          reference: p.reference,
          notice: p.notice,
          is_overdue_fee: p.is_overdue_fee,
          login_id: p.login_id,
          last_synced_at: new Date().toISOString(),
        }));

        const { error: paymentsError } = await admin
          .from("invoice_payments")
          .upsert(paymentsData, { onConflict: "id" });

        if (paymentsError) throw paymentsError;
        paymentsInserted = paymentsData.length;
      }
    } catch (e) {
      console.error(
        `[Sync] Error fetching payments for document ${doc.id}:`,
        e
      );
    }

    return { items: itemsInserted, payments: paymentsInserted };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { items: 0, payments: 0, error: `Doc ${doc.id}: ${msg}` };
  }
}

/**
 * Alle Easybill-Dokumente synchronisieren
 */
export async function syncInvoicesFromEasybill(
  options?: { editedAfter?: string; maxPages?: number }
): Promise<SyncResult> {
  const admin = createAdminClient({ schema: "tms" });

  // Partner-Mapping laden (easybill_customer_number → partner_id)
  const { data: partners, error: partnerError } = await admin
    .from("partners")
    .select("easybill_customer_number, id")
    .not("easybill_customer_number", "is", null);

  if (partnerError) {
    console.error("[Sync] Error loading partners:", partnerError);
  }

  const partnerMap = new Map<number, string>();
  for (const p of partners || []) {
    if (p.easybill_customer_number) {
      partnerMap.set(Number(p.easybill_customer_number), p.id);
    }
  }

  console.log(`[Sync] Loaded ${partnerMap.size} partner mappings`);

  // Sync starten
  const result: SyncResult = {
    documentsFetched: 0,
    documentsInserted: 0,
    documentsUpdated: 0,
    itemsInserted: 0,
    paymentsInserted: 0,
    errors: [],
  };

  let page = 1;
  let totalPages = 1;

  try {
    while (page <= totalPages) {
      console.log(`[Sync] Fetching page ${page}...`);

      const response = await fetchDocumentsPage(
        page,
        1000,
        options?.editedAfter
      );

      totalPages = response.pages || 1;
      result.documentsFetched += response.items.length;

      // Rate-Limit-Schutz: Pause zwischen Requests
      if (page < totalPages) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Jedes Dokument verarbeiten
      for (const doc of response.items) {
        // Nur ab 2023
        const docDate = new Date(doc.document_date);
        if (docDate.getFullYear() < 2023) continue;

        const syncResult = await syncDocument(doc, partnerMap);

        if (syncResult.error) {
          result.errors.push(syncResult.error);
        } else {
          result.itemsInserted += syncResult.items;
          result.paymentsInserted += syncResult.payments;

          // INSERT vs UPDATE unterscheiden (vereinfacht: erst versuchen zu laden)
          const { data: existing } = await admin
            .from("invoices")
            .select("id")
            .eq("id", doc.id)
            .single();

          if (existing) {
            result.documentsUpdated++;
          } else {
            result.documentsInserted++;
          }
        }
      }

      // Max Pages Check
      if (options?.maxPages && page >= options.maxPages) {
        console.log(`[Sync] Stopped after ${options.maxPages} pages`);
        break;
      }

      page++;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Fatal: ${msg}`);
  }

  return result;
}
```

---

## 4. Server Actions

### 4.1 Invoice Actions

```typescript
// src/lib/actions/invoices.ts
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { syncInvoicesFromEasybill, type SyncResult } from "@/lib/easybill/sync";

export interface InvoiceWithItems {
  id: number;
  invoice_number: string;
  type: string;
  document_date: string;
  due_date: string | null;
  payment_status: string;
  paid_amount: number;
  amount: number;
  amount_net: number;
  currency: string;
  partner_name: string | null;
  partner_id: string | null;
  customer_id: number | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

export interface InvoiceItem {
  id: number;
  position: number;
  article_number: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  single_price_net: number;
  total_price_net: number;
  vat_percent: number | null;
  item_type: string | null;
}

export interface InvoicePayment {
  id: number;
  amount: number;
  payment_at: string | null;
  payment_type: string | null;
  provider: string | null;
}

export interface InvoiceListItem {
  id: number;
  invoice_number: string;
  type: string;
  document_date: string;
  due_date: string | null;
  payment_status: string;
  paid_amount: number;
  amount: number;
  amount_net: number;
  currency: string;
  partner_name: string | null;
  customer_id: number | null;
}

/**
 * Alle Rechnungen laden (mit Paginierung)
 */
export async function getInvoices(
  options?: {
    page?: number;
    pageSize?: number;
    paymentStatus?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }
): Promise<{
  ok: true;
  data: InvoiceListItem[];
  totalCount: number;
} | { ok: false; error: string }> {
  const admin = createAdminClient({ schema: "tms" });

  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = admin.from("invoices").select("*", { count: "exact" });

  // Filter anwenden
  if (options?.paymentStatus) {
    query = query.eq("payment_status", options.paymentStatus);
  }
  if (options?.type) {
    query = query.eq("type", options.type);
  }
  if (options?.dateFrom) {
    query = query.gte("document_date", options.dateFrom);
  }
  if (options?.dateTo) {
    query = query.lte("document_date", options.dateTo);
  }
  if (options?.search) {
    query = query.or(
      `invoice_number.ilike.%${options.search}%,partner_name.ilike.%${options.search}%`
    );
  }

  query = query.order("document_date", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[getInvoices]", error);
    return { ok: false, error: "Konnte Rechnungen nicht laden." };
  }

  return { ok: true, data: data ?? [], totalCount: count ?? 0 };
}

/**
 * Einzelne Rechnung mit Positionen und Zahlungen laden
 */
export async function getInvoiceById(
  id: number
): Promise<
  | { ok: true; invoice: InvoiceWithItems }
  | { ok: false; error: string }
> {
  const admin = createAdminClient({ schema: "tms" });

  // Rechnung laden
  const { data: invoice, error: invoiceError } = await admin
    .from("invoices")
    .select("*")
    .eq("id", id)
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, error: "Rechnung nicht gefunden." };
  }

  // Positionen laden
  const { data: items } = await admin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", id)
    .order("position", { ascending: true });

  // Zahlungen laden
  const { data: payments } = await admin
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", id)
    .order("payment_at", { ascending: false });

  return {
    ok: true,
    invoice: {
      ...invoice,
      items: items ?? [],
      payments: payments ?? [],
    },
  };
}

/**
 * Manueller Sync starten (nur Admin)
 */
export async function syncInvoicesNow(): Promise<
  | { ok: true; result: SyncResult }
  | { ok: false; error: string }
> {
  try {
    const result = await syncInvoicesFromEasybill();

    // In Sync-Log speichern
    const admin = createAdminClient({ schema: "tms" });
    await admin.from("invoice_sync_log").insert({
      status: result.errors.length > 0 ? "partial" : "completed",
      documents_fetched: result.documentsFetched,
      documents_inserted: result.documentsInserted,
      documents_updated: result.documentsUpdated,
      items_inserted: result.itemsInserted,
      payments_inserted: result.paymentsInserted,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      error_message: result.errors[0] || null,
      finished_at: new Date().toISOString(),
    });

    return { ok: true, result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: msg };
  }
}

/**
 * Sync-Log laden
 */
export async function getSyncLog(
  limit: number = 20
): Promise<{
  ok: true;
  data: any[];
} | { ok: false; error: string }> {
  const admin = createAdminClient({ schema: "tms" });

  const { data, error } = await admin
    .from("invoice_sync_log")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, error: "Konnte Sync-Log nicht laden." };
  }

  return { ok: true, data: data ?? [] };
}
```

---

## 5. UI-Komponenten

### 5.1 Komponenten-Struktur

```
src/app/(app)/verwaltung/invoices/
├── page.tsx                          # Server-Komponente (Admin-Check)
├── [id]/
│   └── page.tsx                      # Detailseite einer Rechnung
├── sync/
│   └── page.tsx                      # Sync-Status + manueller Sync
└── components/
    ├── invoice-table.tsx             # Tabelle aller Rechnungen
    ├── invoice-filter.tsx            # Filter (Status, Typ, Zeitraum, Suche)
    ├── invoice-detail.tsx            # Detail-Ansicht einer Rechnung
    ├── invoice-items-table.tsx       # Positionen einer Rechnung
    ├── invoice-payments-table.tsx    # Zahlungen einer Rechnung
    ├── payment-status-badge.tsx      # Farbiger Status-Badge
    ├── sync-status-card.tsx          # Sync-Status-Anzeige
    └── sync-log-table.tsx            # Tabelle der Sync-Logs
```

### 5.2 Payment Status Badge

```tsx
// src/app/(app)/verwaltung/invoices/components/payment-status-badge.tsx
"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig = {
  paid: { label: "Bezahlt", variant: "default" as const },
  partial: { label: "Teilweise", variant: "secondary" as const },
  open: { label: "Offen", variant: "destructive" as const },
  overdue: { label: "Überfällig", variant: "destructive" as const },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: "outline" as const,
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
```

### 5.3 Invoice Table

```tsx
// src/app/(app)/verwaltung/invoices/components/invoice-table.tsx
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentStatusBadge } from "./payment-status-badge";
import { formatCent } from "@/lib/utils";

interface InvoiceTableProps {
  invoices: InvoiceListItem[];
}

export function InvoiceTable({ invoices }: InvoiceTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rechnungsnr.</TableHead>
          <TableHead>Kunde</TableHead>
          <TableHead>Datum</TableHead>
          <TableHead>Fällig</TableHead>
          <TableHead>Netto</TableHead>
          <TableHead>Bezahlt</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((invoice) => (
          <TableRow key={invoice.id}>
            <TableCell className="font-medium">
              {invoice.invoice_number}
            </TableCell>
            <TableCell>{invoice.partner_name || "—"}</TableCell>
            <TableCell>
              {new Date(invoice.document_date).toLocaleDateString("de-DE")}
            </TableCell>
            <TableCell>
              {invoice.due_date
                ? new Date(invoice.due_date).toLocaleDateString("de-DE")
                : "—"}
            </TableCell>
            <TableCell>{formatCent(invoice.amount_net)}</TableCell>
            <TableCell>{formatCent(invoice.paid_amount)}</TableCell>
            <TableCell>
              <PaymentStatusBadge status={invoice.payment_status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 5.4 Invoice Detail

```tsx
// src/app/(app)/verwaltung/invoices/[id]/page.tsx
import { getInvoiceById } from "@/lib/actions/invoices";
import { notFound } from "next/navigation";
import { PaymentStatusBadge } from "../components/payment-status-badge";
import { formatCent } from "@/lib/utils";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getInvoiceById(Number(id));

  if (!result.ok) return notFound();
  const invoice = result.invoice;

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Rechnung {invoice.invoice_number}
          </h1>
          <p className="text-muted-foreground">
            {invoice.partner_name || "—"}
          </p>
        </div>
        <PaymentStatusBadge status={invoice.payment_status} />
      </div>

      {/* Beträge */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Brutto</p>
          <p className="text-xl font-semibold">{formatCent(invoice.amount)}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Netto</p>
          <p className="text-xl font-semibold">
            {formatCent(invoice.amount_net)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Bezahlt</p>
          <p className="text-xl font-semibold text-green-600">
            {formatCent(invoice.paid_amount)}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Offen</p>
          <p className="text-xl font-semibold text-red-600">
            {formatCent(invoice.amount - invoice.paid_amount)}
          </p>
        </div>
      </div>

      {/* Positionen */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Positionen</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Pos</th>
              <th className="text-left py-2">Artikelnr.</th>
              <th className="text-left py-2">Beschreibung</th>
              <th className="text-right py-2">Menge</th>
              <th className="text-right py-2">Einzelpreis</th>
              <th className="text-right py-2">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="py-2">{item.position}</td>
                <td className="py-2">{item.article_number || "—"}</td>
                <td className="py-2">{item.description}</td>
                <td className="text-right py-2">
                  {item.quantity} {item.unit}
                </td>
                <td className="text-right py-2">
                  {formatCent(item.single_price_net)}
                </td>
                <td className="text-right py-2">
                  {formatCent(item.total_price_net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Zahlungen */}
      {invoice.payments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Zahlungen</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Datum</th>
                <th className="text-left py-2">Art</th>
                <th className="text-right py-2">Betrag</th>
                <th className="text-left py-2">Referenz</th>
              </tr>
            </thead>
            <tbody>
              {invoice.payments.map((payment) => (
                <tr key={payment.id} className="border-b">
                  <td className="py-2">
                    {payment.payment_at
                      ? new Date(payment.payment_at).toLocaleDateString("de-DE")
                      : "—"}
                  </td>
                  <td className="py-2">{payment.payment_type || "—"}</td>
                  <td className="text-right py-2">
                    {formatCent(payment.amount)}
                  </td>
                  <td className="py-2">{payment.reference || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

### 5.5 Sync-Status Page

```tsx
// src/app/(app)/verwaltung/invoices/sync/page.tsx
"use client";

import { useState } from "react";
import { syncInvoicesNow, getSyncLog } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SyncStatusPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  async function handleSync() {
    setIsSyncing(true);
    try {
      const result = await syncInvoicesNow();
      if (result.ok) {
        setLastResult(result.result);
      }
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Invoice-Sync</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manueller Sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Starte einen manuellen Sync mit der Easybill API. Dies lädt alle
            Rechnungen, Positionen und Zahlungen seit dem 01.01.2023.
          </p>
          <Button onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? "Synchronisiere..." : "Jetzt synchronisieren"}
          </Button>

          {lastResult && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p>
                <strong>Dokumente geladen:</strong> {lastResult.documentsFetched}
              </p>
              <p>
                <strong>Neu:</strong> {lastResult.documentsInserted}
              </p>
              <p>
                <strong>Aktualisiert:</strong> {lastResult.documentsUpdated}
              </p>
              <p>
                <strong>Positionen:</strong> {lastResult.itemsInserted}
              </p>
              <p>
                <strong>Zahlungen:</strong> {lastResult.paymentsInserted}
              </p>
              {lastResult.errors.length > 0 && (
                <p className="text-red-600">
                  <strong>Fehler:</strong> {lastResult.errors.length}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 6. Cronjob

### 6.1 Einrichtung (via OpenClaw Cron)

```json
{
  "name": "Easybill Invoice Sync (Täglich)",
  "schedule": {
    "kind": "cron",
    "expr": "0 2 * * *",
    "tz": "Europe/Berlin"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "Führe den täglichen Easybill Invoice-Sync durch. Lade alle Dokumente vom Typ INVOICE, CREDIT, STORNO, STORNO_CREDIT ab 01.01.2023. Für jedes Dokument: Positionen und Zahlungen abrufen. Speichere in tms.invoices (UPSERT), tms.invoice_items (UPSERT), tms.invoice_payments (UPSERT). Berechne Bezahlstatus. Logge Ergebnisse in tms.invoice_sync_log. Verwende Service-Role-Client.",
    "model": "ollama-cloud/kimi-k2.6"
  },
  "sessionTarget": "isolated",
  "delivery": {
    "mode": "announce"
  }
}
```

---

## 7. Utility-Funktionen

### 7.1 Cent zu Euro formatieren

```typescript
// src/lib/utils.ts (erweitern)

export function formatCent(cents: number | null): string {
  if (cents === null || cents === undefined) return "—";
  const euros = cents / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}
```

---

## 8. Testing (nach Deploy)

```sql
-- Test 1: Tabellen existieren
SELECT COUNT(*) FROM tms.invoices;
SELECT COUNT(*) FROM tms.invoice_items;
SELECT COUNT(*) FROM tms.invoice_payments;

-- Test 2: Bezahlstatus korrekt berechnet
SELECT payment_status, COUNT(*) FROM tms.invoices GROUP BY payment_status;

-- Test 3: Partner-Verknüpfung
SELECT i.invoice_number, p.display_name
FROM tms.invoices i
LEFT JOIN tms.partners p ON i.partner_id = p.id
WHERE i.partner_id IS NOT NULL
LIMIT 10;

-- Test 4: Rechnungen mit Positionen
SELECT i.invoice_number, COUNT(ii.id) as items
FROM tms.invoices i
LEFT JOIN tms.invoice_items ii ON i.id = ii.invoice_id
GROUP BY i.id, i.invoice_number
ORDER BY items DESC
LIMIT 10;

-- Test 5: Rechnungen mit Zahlungen
SELECT i.invoice_number, COUNT(ip.id) as payments, SUM(ip.amount) as total_paid
FROM tms.invoices i
LEFT JOIN tms.invoice_payments ip ON i.id = ip.invoice_id
GROUP BY i.id, i.invoice_number
HAVING COUNT(ip.id) > 0
LIMIT 10;
```

---

## 9. Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| API-Rate-Limit (60 req/min) überschritten | Mittel | 1 Sekunde Pause zwischen Requests, Retry bei 429 |
| API-Key ungültig | Niedrig | Prüfung vor Sync, Fehler-Log |
| Große Datenmenge (>10.000 Rechnungen) | Mittel | Pagination, Batch-Verarbeitung |
| Easybill-Downtime | Niedrig | Fehler-Log, nächster Tag erneut |
| Kunde nicht in TMS gefunden | Mittel | partner_id = NULL, Liste für manuelles Matching |
| Datum-Parsing fehlerhaft | Niedrig | ISO-Format, Validierung |
| Gutschriften/STORNO als negative Beträge | — | Betrag bleibt wie Easybill liefert (CREDIT = negativ) |

---

## 10. Nächste Schritte (nach diesem PR)

1. **Backend:** Datenbank-Migration ausführen (SQL)
2. **Backend:** Easybill API-Client implementieren
3. **Backend:** Sync-Script implementieren
4. **Backend:** Server Actions implementieren
5. **Frontend:** Invoice-Übersicht bauen
6. **Frontend:** Invoice-Detail bauen
7. **Frontend:** Sync-Status-Page bauen
8. **Cronjob:** Täglichen Sync einrichten
9. **QA:** Test gegen Akzeptanzkriterien

---

**Warte auf Approval von Jan Bernd bevor ich mit Backend/Frontend beginne.**
