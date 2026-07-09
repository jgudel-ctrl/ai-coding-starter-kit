/**
 * Standalone Sync-Test — Seite 1300 (2023-Rechnungen)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://supabase.gudel-werkzeuge.de";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EASYBILL_KEY = process.env.EASYBILL_API_KEY;

if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");
if (!EASYBILL_KEY) throw new Error("EASYBILL_API_KEY fehlt");

const BASE_URL = "https://api.easybill.de/rest/v1";

// SERVICE ROLE CLIENT — umgeht RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "tms" },
});

async function easybillFetch(endpoint: string) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${EASYBILL_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Easybill ${res.status}`);
  return res.json();
}

function calcStatus(paid: number, total: number, due: string | null): string {
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  if (due) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(due) < today) return "overdue";
  }
  return "open";
}

async function main() {
  console.log("🚀 Echter Sync-Test — Seite 1300 (2023-Rechnungen)\n");

  // Partner-Mapping
  const { data: partners, error: pErr } = await supabase
    .from("partners")
    .select("easybill_customer_number, id")
    .not("easybill_customer_number", "is", null);

  if (pErr) {
    console.error("Partner-Fehler:", pErr);
    return;
  }

  const partnerMap = new Map();
  for (const p of partners || []) {
    partnerMap.set(Number(p.easybill_customer_number), p.id);
  }
  console.log(`📋 ${partnerMap.size} Partner geladen\n`);

  // Seite 1300 laden
  const types = "INVOICE,CREDIT,STORNO,STORNO_CREDIT";
  const data = await easybillFetch(`/documents?limit=5&page=1300&is_draft=false&type=${types}`);

  console.log(`📄 ${data.items.length} Dokumente auf Seite 1300:`);
  data.items.forEach((d: any) => {
    console.log(`   ${d.number} ${d.type} ${d.document_date} net=${d.amount_net} paid=${d.paid_amount}`);
  });
  console.log();

  const docs = data.items.filter((d: any) => new Date(d.document_date).getFullYear() >= 2023);
  console.log(`${docs.length} Dokumente ab 2023 gefunden\n`);

  let inserted = 0, updated = 0, itemsTotal = 0, errors = 0;

  for (const doc of docs) {
    try {
      const partnerId = doc.customer_id ? partnerMap.get(Number(doc.customer_id)) : null;
      const status = calcStatus(doc.paid_amount || 0, doc.amount || 0, doc.due_date);

      console.log(`⏳ ${doc.number} — ${status} — Partner: ${partnerId || "nicht gefunden"}`);

      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("id", doc.id)
        .maybeSingle();

      // Mit SERVICE ROLE upsert (bypass RLS)
      const { error: uErr } = await supabase.from("invoices").upsert({
        id: doc.id,
        invoice_number: doc.number,
        type: doc.type,
        document_date: doc.document_date,
        due_date: doc.due_date,
        customer_id: doc.customer_id,
        partner_id: partnerId,
        partner_name: doc.address?.company_name || doc.address?.last_name || null,
        amount: doc.amount,
        amount_net: doc.amount_net,
        paid_amount: doc.paid_amount,
        currency: doc.currency,
        payment_status: status,
        paid_at: doc.paid_at,
        order_number: doc.order_number,
        address: doc.address,
        created_at: doc.created_at,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (uErr) {
        console.error("   ❌ Upsert-Fehler:", JSON.stringify(uErr));
        errors++;
        continue;
      }

      if (existing) updated++;
      else inserted++;

      // Positionen direkt aus doc.items
      try {
        if (doc.items?.length > 0) {
          const toInsert = doc.items.map((item: any) => ({
            id: item.id,
            invoice_id: doc.id,
            position: item.position,
            type: item.type,
            item_type: item.itemType,
            article_number: item.number,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            single_price_net: item.single_price_net,
            total_price_net: item.total_price_net,
            vat_percent: item.vat_percent,
            last_synced_at: new Date().toISOString(),
          }));
          const { error: iErr } = await supabase.from("invoice_items").upsert(toInsert, { onConflict: "id" });
          if (iErr) console.log("   ⚠️ Items-Fehler:", iErr.message);
          else {
            itemsTotal += toInsert.length;
            console.log(`   ✅ ${toInsert.length} Positionen`);
          }
        }
      } catch (e) {
        console.log(`   ⚠️ Positionen fehlgeschlagen`);
      }

      await new Promise(r => setTimeout(r, 500));

    } catch (e: any) {
      console.error(`❌ ${doc.id}: ${e.message}`);
      errors++;
    }
  }

  // Sync-Log
  await supabase.from("invoice_sync_log").insert({
    sync_type: "manual_test_page1300",
    documents_fetched: docs.length,
    documents_inserted: inserted,
    documents_updated: updated,
    items_inserted: itemsTotal,
    payments_inserted: 0,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: errors > 0 ? "partial" : "completed",
    error_message: errors > 0 ? `${errors} Fehler` : null,
  });

  console.log("\n📊 Zusammenfassung:");
  console.log(`   Gespeichert: ${inserted}`);
  console.log(`   Aktualisiert: ${updated}`);
  console.log(`   Positionen: ${itemsTotal}`);
  console.log(`   Fehler: ${errors}`);

  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  console.log(`\n💾 Invoices in DB gesamt: ${count}`);
}

main().catch(console.error);
