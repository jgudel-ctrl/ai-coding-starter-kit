/**
 * Test-Script für Easybill Invoice-Sync (Standalone)
 * Führt einen kleinen Sync direkt mit Supabase durch.
 *
 * Usage:
 *   EASYBILL_API_KEY=xxx \
 *   SUPABASE_URL=xxx \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/test-easybill-sync-standalone.ts
 */

import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────
// Konfiguration
// ─────────────────────────────────────────
const API_KEY = process.env.EASYBILL_API_KEY;
if (!API_KEY) throw new Error("EASYBILL_API_KEY fehlt");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("SUPABASE_URL fehlt");

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");

const BASE_URL = "https://api.easybill.de/rest/v1";

// ─────────────────────────────────────────
// Supabase Client
// ─────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "tms" },
});

// ─────────────────────────────────────────
// Easybill API
// ─────────────────────────────────────────
async function easybillFetch<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 429) {
    console.warn("Rate limit, warte 3 Sekunden...");
    await new Promise((r) => setTimeout(r, 3000));
    return easybillFetch(endpoint);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Easybill ${response.status}: ${text}`);
  }

  return response.json();
}

// ─────────────────────────────────────────
// Partner-Mapping
// ─────────────────────────────────────────
async function loadPartnerMap(): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from("partners")
    .select("easybill_customer_number, id")
    .not("easybill_customer_number", "is", null);

  if (error) {
    console.error("Partner-Fehler:", error);
    return new Map();
  }

  const map = new Map<number, string>();
  for (const p of data || []) {
    if (p.easybill_customer_number) {
      map.set(Number(p.easybill_customer_number), p.id);
    }
  }
  return map;
}

// ─────────────────────────────────────────
// Bezahlstatus
// ─────────────────────────────────────────
function calcPaymentStatus(
  paid: number,
  total: number,
  due: string | null
): string {
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  if (due) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(due) < today) return "overdue";
  }
  return "open";
}

// ─────────────────────────────────────────
// Einzelnes Dokument syncen
// ─────────────────────────────────────────
async function syncDocument(
  doc: any,
  partnerMap: Map<number, string>
): Promise<{ items: number; payments: number; error?: string }> {
  try {
    const partnerId = doc.customer_id
      ? partnerMap.get(doc.customer_id) || null
      : null;

    const partnerName =
      doc.address?.company_name || doc.address?.last_name || null;

    const paymentStatus = calcPaymentStatus(
      doc.paid_amount || 0,
      doc.amount || 0,
      doc.due_date
    );

    // Invoice
    const { error: iErr } = await supabase.from("invoices").upsert(
      {
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
        created_at: doc.created_at,
        edited_at: doc.edited_at,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (iErr) throw iErr;

    // Positionen
    let itemsCount = 0;
    if (doc.items && doc.items.length > 0) {
      const itemsData = doc.items.map((item: any) => ({
        id: item.id,
        invoice_id: doc.id,
        position: item.position,
        type: item.type,
        item_type: item.itemType,
        article_number: item.number,
        description: item.description,
        quantity: item.quantity,
        quantity_str: item.quantity_str,
        unit: item.unit,
        single_price_net: item.single_price_net,
        single_price_gross: item.single_price_gross,
        total_price_net: item.total_price_net,
        total_price_gross: item.total_price_gross,
        total_vat: item.total_vat,
        vat_percent: item.vat_percent,
        last_synced_at: new Date().toISOString(),
      }));

      const { error: eErr } = await supabase
        .from("invoice_items")
        .upsert(itemsData, { onConflict: "id" });
      if (eErr) throw eErr;
      itemsCount = itemsData.length;
    }

    return { items: itemsCount, payments: 0 };
  } catch (e: any) {
    return { items: 0, payments: 0, error: `Doc ${doc.id}: ${e.message}` };
  }
}

// ─────────────────────────────────────────
// Hauptfunktion
// ─────────────────────────────────────────
async function main() {
  console.log("🚀 Starte Easybill Sync-Test (2 Seiten)...\n");

  const partnerMap = await loadPartnerMap();
  console.log(`📋 ${partnerMap.size} Partner-Mappings geladen\n`);

  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  let itemsTotal = 0;
  const errors: string[] = [];

  for (let page = 1; page <= 2; page++) {
    console.log(`📄 Seite ${page} laden...`);

    const data = await easybillFetch<any>(
      `/documents?limit=100&page=${page}&is_draft=false&type=INVOICE,CREDIT,STORNO,STORNO_CREDIT`
    );

    console.log(
      `   ${data.items?.length || 0} Dokumente gefunden`);
    fetched += data.items?.length || 0;

    for (const doc of data.items || []) {
      const year = new Date(doc.document_date).getFullYear();
      if (year < 2023) continue;

      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", doc.id)
        .maybeSingle();

      const isUpdate = !!existing;

      const result = await syncDocument(doc, partnerMap);
      if (result.error) {
        errors.push(result.error);
      } else {
        itemsTotal += result.items;
        if (isUpdate) updated++;
        else inserted++;
      }
    }

    if (page < 2) {
      console.log("   ⏳ Pause (Rate-Limit)...\n");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("\n✅ Sync-Test abgeschlossen!");
  console.log(`   Dokumente geladen: ${fetched}`);
  console.log(`   Neu:              ${inserted}`);
  console.log(`   Aktualisiert:     ${updated}`);
  console.log(`   Positionen:       ${itemsTotal}`);
  console.log(`   Fehler:           ${errors.length}`);

  if (errors.length > 0) {
    console.log("\n⚠️  Fehler:");
    errors.forEach((e) => console.log(`   - ${e}`));
  }
}

main().catch(console.error);
