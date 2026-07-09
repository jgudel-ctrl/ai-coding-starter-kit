/**
 * Standalone Sync-Test (vollständig unabhängig)
 * Lädt 2 Seiten à 1000 Dokumente und speichert alle ab 2023.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://supabase.gudel-werkzeuge.de";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EASYBILL_KEY = process.env.EASYBILL_API_KEY;

if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");
if (!EASYBILL_KEY) throw new Error("EASYBILL_API_KEY fehlt");

const BASE_URL = "https://api.easybill.de/rest/v1";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "tms" },
});

async function easybillFetch(endpoint: string) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${EASYBILL_KEY}`,
      "Content-Type": "application/json",
    },
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
  console.log("🚀 Echter Sync-Test (2 Seiten à 1000 Dokumente)\n");

  // Partner-Mapping
  const { data: partners } = await supabase
    .from("partners")
    .select("easybill_customer_number, id")
    .not("easybill_customer_number", "is", null);

  const partnerMap = new Map();
  for (const p of partners || []) {
    partnerMap.set(Number(p.easybill_customer_number), p.id);
  }
  console.log(`📋 ${partnerMap.size} Partner geladen\n`);

  const types = "INVOICE,CREDIT,STORNO,STORNO_CREDIT";
  let inserted = 0, updated = 0, itemsTotal = 0, paymentsTotal = 0, errors = 0;
  let totalFetched = 0;

  for (let page = 1; page <= 2; page++) {
    console.log(`📄 Seite ${page}...`);
    const data = await easybillFetch(
      `/documents?limit=1000&page=${page}&is_draft=false&type=${types}`
    );

    const docs = (data.items || []).filter((d: any) =>
      new Date(d.document_date).getFullYear() >= 2023
    );

    console.log(`   ${data.items?.length || 0} geladen, ${docs.length} ab 2023`);
    totalFetched += docs.length;

    for (const doc of docs) {
      try {
        const partnerId = doc.customer_id ? partnerMap.get(Number(doc.customer_id)) : null;
        const status = calcStatus(doc.paid_amount || 0, doc.amount || 0, doc.due_date);

        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("id", doc.id)
          .maybeSingle();

        await supabase.from("invoices").upsert({
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

        if (existing) updated++;
        else inserted++;

        // Positionen
        try {
          const itemsData = await easybillFetch(`/documents/${doc.id}/items`);
          if (itemsData.items?.length > 0) {
            const toInsert = itemsData.items.map((item: any) => ({
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
            await supabase.from("invoice_items").upsert(toInsert, { onConflict: "id" });
            itemsTotal += toInsert.length;
          }
        } catch (e) {
          console.log(`   ⚠️ Positionen für ${doc.id} fehlgeschlagen`);
        }

        // Zahlungen
        try {
          const payData = await easybillFetch(`/documents/${doc.id}/payments`);
          if (payData.items?.length > 0) {
            const toInsert = payData.items.map((p: any) => ({
              id: p.id,
              invoice_id: doc.id,
              amount: p.amount,
              payment_at: p.payment_at,
              payment_type: p.type,
              provider: p.provider,
              last_synced_at: new Date().toISOString(),
            }));
            await supabase.from("invoice_payments").upsert(toInsert, { onConflict: "id" });
            paymentsTotal += toInsert.length;
          }
        } catch (e) {
          console.log(`   ⚠️ Zahlungen für ${doc.id} fehlgeschlagen`);
        }

        if ((inserted + updated) % 10 === 0) {
          console.log(`   ...${inserted + updated} gespeichert`);
        }

      } catch (e: any) {
        console.error(`❌ ${doc.id}: ${e.message}`);
        errors++;
      }
    }

    if (page < 2) {
      console.log("   ⏳ Pause (Rate-Limit)...");
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Sync-Log
  await supabase.from("invoice_sync_log").insert({
    sync_type: "manual_test",
    documents_fetched: totalFetched,
    documents_inserted: inserted,
    documents_updated: updated,
    items_inserted: itemsTotal,
    payments_inserted: paymentsTotal,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status: errors > 0 ? "partial" : "completed",
    error_message: errors > 0 ? `${errors} Fehler` : null,
  });

  console.log("\n📊 Zusammenfassung:");
  console.log(`   Ab 2023 gefunden: ${totalFetched}`);
  console.log(`   Gespeichert: ${inserted}`);
  console.log(`   Aktualisiert: ${updated}`);
  console.log(`   Positionen: ${itemsTotal}`);
  console.log(`   Zahlungen: ${paymentsTotal}`);
  console.log(`   Fehler: ${errors}`);

  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  console.log(`\n💾 Invoices in DB gesamt: ${count}`);
}

main().catch(console.error);
