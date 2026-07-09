/**
 * Easybill Invoice-Sync Logik
 *
 * Lädt alle Rechnungen, Positionen und Zahlungen aus der Easybill API
 * und speichert sie in der Datenbank (tms.invoices, tms.invoice_items, tms.invoice_payments).
 *
 * Bezahlstatus wird automatisch berechnet:
 * - paid:     paid_amount >= amount
 * - partial:  paid_amount > 0
 * - overdue:  due_date < heute UND offen
 * - open:     sonst
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchDocumentsPage,
  fetchDocumentItems,
  fetchDocumentPayments,
  delayBetweenRequests,
} from "./client";

// ============================================================
// Typen
// ============================================================

export type PaymentStatus = "paid" | "partial" | "open" | "overdue";

export interface SyncResult {
  documentsFetched: number;
  documentsInserted: number;
  documentsUpdated: number;
  itemsInserted: number;
  paymentsInserted: number;
  errors: string[];
}

// ============================================================
// Hilfsfunktionen
// ============================================================

/**
 * Bezahlstatus berechnen
 */
function calculatePaymentStatus(
  paidAmount: number,
  totalAmount: number,
  dueDate: string | null
): PaymentStatus {
  if (paidAmount >= totalAmount) return "paid";
  if (paidAmount > 0) return "partial";
  if (dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    if (due < today) return "overdue";
  }
  return "open";
}

/**
 * Prüft ob ein Datum ab 01.01.2023 liegt
 */
function isFrom2023OrLater(dateStr: string): boolean {
  const date = new Date(dateStr);
  return date.getFullYear() >= 2023;
}

// ============================================================
// Einzelnes Dokument synchronisieren
// ============================================================

/**
 * Ein Dokument mit seinen Positionen und Zahlungen in die DB speichern.
 *
 * @param doc Easybill-Dokument
 * @param partnerMap Map: easybill_customer_number → partner_id
 * @returns Anzahl Items, Anzahl Payments, ggf. Fehler
 */
async function syncDocument(
  doc: any,
  partnerMap: Map<number, string>
): Promise<{ items: number; payments: number; error?: string }> {
  const admin = createAdminClient({ schema: "tms" });

  try {
    // Partner verknüpfen (via easybill_customer_number)
    const partnerId = doc.customer_id
      ? partnerMap.get(doc.customer_id) || null
      : null;

    // Kundenname aus Adresse extrahieren (Fallback)
    const partnerName =
      doc.address?.company_name ||
      doc.address?.last_name ||
      null;

    // Bezahlstatus berechnen
    const paymentStatus = calculatePaymentStatus(
      doc.paid_amount || 0,
      doc.amount || 0,
      doc.due_date
    );

    // Invoice-Daten zusammenbauen
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
      partner_name: partnerName,
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

    // Invoice speichern (UPSERT)
    const { error: upsertError } = await admin
      .from("invoices")
      .upsert(invoiceData, { onConflict: "id" });

    if (upsertError) throw upsertError;

    // ─────────────────────────────────────────
    // Positionen abrufen und speichern
    // ─────────────────────────────────────────
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
      console.error(
        `[Sync] Fehler beim Abrufen der Positionen für Dokument ${doc.id}:`,
        e
      );
    }

    // ─────────────────────────────────────────
    // Zahlungen abrufen und speichern
    // ─────────────────────────────────────────
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
        `[Sync] Fehler beim Abrufen der Zahlungen für Dokument ${doc.id}:`,
        e
      );
    }

    return { items: itemsInserted, payments: paymentsInserted };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      items: 0,
      payments: 0,
      error: `Dokument ${doc.id} (${doc.number}): ${msg}`,
    };
  }
}

// ============================================================
// Hauptsynchronisations-Funktion
// ============================================================

/**
 * Alle Easybill-Rechnungen synchronisieren.
 *
 * @param options Konfiguration
 *   - editedAfter: Nur Dokumente, die nach diesem Datum bearbeitet wurden (ISO-Format)
 *   - maxPages: Max. Anzahl Seiten (für Test/Debug)
 */
export async function syncInvoicesFromEasybill(
  options?: { editedAfter?: string; maxPages?: number }
): Promise<SyncResult> {
  const admin = createAdminClient({ schema: "tms" });

  console.log("[Sync] Starte Invoice-Synchronisation...");

  // ─────────────────────────────────────────
  // Partner-Mapping laden (easybill_customer_number → partner_id)
  // ─────────────────────────────────────────
  const { data: partners, error: partnerError } = await admin
    .from("partners")
    .select("easybill_customer_number, id")
    .not("easybill_customer_number", "is", null);

  if (partnerError) {
    console.error("[Sync] Fehler beim Laden der Partner:", partnerError);
  }

  const partnerMap = new Map<number, string>();
  for (const p of partners || []) {
    if (p.easybill_customer_number) {
      partnerMap.set(Number(p.easybill_customer_number), p.id);
    }
  }

  console.log(`[Sync] ${partnerMap.size} Partner-Mappings geladen`);

  // ─────────────────────────────────────────
  // Sync starten
  // ─────────────────────────────────────────
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
      console.log(`[Sync] Lade Seite ${page}...`);

      const response = await fetchDocumentsPage(
        page,
        1000,
        options?.editedAfter
      );

      totalPages = response.pages || 1;
      result.documentsFetched += response.items.length;

      console.log(
        `[Sync] ${response.items.length} Dokumente auf Seite ${page}/${totalPages}`
      );

      // Jedes Dokument verarbeiten
      for (const doc of response.items) {
        // Nur ab 01.01.2023
        if (!isFrom2023OrLater(doc.document_date)) continue;

        // Prüfe ob Invoice schon existiert (für Statistik)
        const { data: existing } = await admin
          .from("invoices")
          .select("id")
          .eq("id", doc.id)
          .single();

        const isUpdate = !!existing;

        // Dokument syncen
        const syncResult = await syncDocument(doc, partnerMap);

        if (syncResult.error) {
          result.errors.push(syncResult.error);
          console.error(`[Sync] Fehler: ${syncResult.error}`);
        } else {
          result.itemsInserted += syncResult.items;
          result.paymentsInserted += syncResult.payments;

          if (isUpdate) {
            result.documentsUpdated++;
          } else {
            result.documentsInserted++;
          }
        }
      }

      // Rate-Limit-Schutz: Pause zwischen Seiten
      if (page < totalPages) {
        await delayBetweenRequests();
      }

      // Max Pages Check
      if (options?.maxPages && page >= options.maxPages) {
        console.log(`[Sync] Gestoppt nach ${options.maxPages} Seiten`);
        break;
      }

      page++;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Fataler Fehler: ${msg}`);
    console.error(`[Sync] Fataler Fehler:`, error);
  }

  // ─────────────────────────────────────────
  // Zusammenfassung
  // ─────────────────────────────────────────
  console.log("\n[Sync] === ZUSAMMENFASSUNG ===");
  console.log(`[Sync] Dokumente geladen: ${result.documentsFetched}`);
  console.log(`[Sync] Neu eingefügt:     ${result.documentsInserted}`);
  console.log(`[Sync] Aktualisiert:      ${result.documentsUpdated}`);
  console.log(`[Sync] Positionen:        ${result.itemsInserted}`);
  console.log(`[Sync] Zahlungen:         ${result.paymentsInserted}`);
  console.log(`[Sync] Fehler:            ${result.errors.length}`);
  console.log("[Sync] ===========================\n");

  return result;
}
