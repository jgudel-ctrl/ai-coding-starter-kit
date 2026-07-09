"use server";

/**
 * Server Actions für Invoice-Verwaltung
 *
 * Funktionen:
 * - getInvoices:        Alle Rechnungen (mit Filter/Paginierung)
 * - getInvoiceById:     Einzelne Rechnung mit Positionen + Zahlungen
 * - syncInvoicesNow:    Manuellen Sync starten
 * - getSyncLog:         Sync-History abrufen
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncInvoicesFromEasybill,
  type SyncResult,
} from "@/lib/easybill/sync";

// ============================================================
// Typen
// ============================================================

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
  partner_id: string | null;
  customer_id: number | null;
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

export interface InvoiceWithDetails {
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
  customer_snapshot: any;
  address: any;
  text: string | null;
  text_prefix: string | null;
  paid_at: string | null;
  order_number: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
}

// ============================================================
// Rechnungen auflisten (mit Filter)
// ============================================================

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
): Promise<
  | { ok: true; data: InvoiceListItem[]; totalCount: number }
  | { ok: false; error: string }
> {
  const admin = createAdminClient({ schema: "tms" });

  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // SELECT * mit COUNT
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

  // Sortierung + Paginierung
  query = query.order("document_date", { ascending: false }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[getInvoices] Fehler:", error);
    return { ok: false, error: "Konnte Rechnungen nicht laden." };
  }

  return { ok: true, data: (data ?? []) as InvoiceListItem[], totalCount: count ?? 0 };
}

// ============================================================
// Einzelne Rechnung mit Details
// ============================================================

export async function getInvoiceById(
  id: number
): Promise<
  | { ok: true; invoice: InvoiceWithDetails }
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
    console.error("[getInvoiceById] Fehler:", invoiceError);
    return { ok: false, error: "Rechnung nicht gefunden." };
  }

  // Positionen laden
  const { data: items } = await admin
    .from("invoice_items")
    .select("id, position, article_number, description, quantity, unit, single_price_net, total_price_net, vat_percent, item_type")
    .eq("invoice_id", id)
    .order("position", { ascending: true });

  // Zahlungen laden
  const { data: payments } = await admin
    .from("invoice_payments")
    .select("id, amount, payment_at, payment_type, provider")
    .eq("invoice_id", id)
    .order("payment_at", { ascending: false });

  return {
    ok: true,
    invoice: {
      ...invoice,
      items: (items ?? []) as InvoiceItem[],
      payments: (payments ?? []) as InvoicePayment[],
    } as InvoiceWithDetails,
  };
}

// ============================================================
// Manueller Sync
// ============================================================

export async function syncInvoicesNow(): Promise<
  | { ok: true; result: SyncResult }
  | { ok: false; error: string }
> {
  try {
    console.log("[SyncAction] Starte manuellen Sync...");

    // Sync-Log Eintrag erstellen
    const admin = createAdminClient({ schema: "tms" });
    const { data: logEntry } = await admin
      .from("invoice_sync_log")
      .insert({ status: "running" })
      .select()
      .single();

    const logId = logEntry?.id;

    // Sync durchführen
    const result = await syncInvoicesFromEasybill();

    // Sync-Log aktualisieren
    const status = result.errors.length > 0 ? "partial" : "completed";
    await admin
      .from("invoice_sync_log")
      .update({
        status,
        documents_fetched: result.documentsFetched,
        documents_inserted: result.documentsInserted,
        documents_updated: result.documentsUpdated,
        items_inserted: result.itemsInserted,
        payments_inserted: result.paymentsInserted,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        error_message: result.errors[0] || null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", logId);

    return { ok: true, result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[syncInvoicesNow] Fehler:", error);

    // Fehler in Sync-Log speichern
    const admin = createAdminClient({ schema: "tms" });
    await admin.from("invoice_sync_log").insert({
      status: "failed",
      error_message: msg,
      finished_at: new Date().toISOString(),
    });

    return { ok: false, error: msg };
  }
}

// ============================================================
// Sync-Log abrufen
// ============================================================

export async function getSyncLog(
  limit: number = 20
): Promise<
  | { ok: true; data: any[] }
  | { ok: false; error: string }
> {
  const admin = createAdminClient({ schema: "tms" });

  const { data, error } = await admin
    .from("invoice_sync_log")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getSyncLog] Fehler:", error);
    return { ok: false, error: "Konnte Sync-Log nicht laden." };
  }

  return { ok: true, data: data ?? [] };
}

// ============================================================
// Zusammenfassung (für Dashboard / Kunde)
// ============================================================

export async function getInvoiceSummary(
  partnerId?: string
): Promise<
  | {
      ok: true;
      totalInvoices: number;
      totalPaid: number;
      totalOpen: number;
      totalOverdue: number;
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient({ schema: "tms" });

  let query = admin.from("invoices").select("payment_status, amount, paid_amount");

  if (partnerId) {
    query = query.eq("partner_id", partnerId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getInvoiceSummary] Fehler:", error);
    return { ok: false, error: "Konnte Zusammenfassung nicht laden." };
  }

  const rows = data ?? [];
  const totalInvoices = rows.length;
  const totalPaid = rows
    .filter((r) => r.payment_status === "paid")
    .reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalOpen = rows
    .filter((r) => r.payment_status === "open" || r.payment_status === "partial")
    .reduce((sum, r) => sum + (r.amount || 0) - (r.paid_amount || 0), 0);
  const totalOverdue = rows
    .filter((r) => r.payment_status === "overdue")
    .reduce((sum, r) => sum + (r.amount || 0) - (r.paid_amount || 0), 0);

  return {
    ok: true,
    totalInvoices,
    totalPaid,
    totalOpen,
    totalOverdue,
  };
}
