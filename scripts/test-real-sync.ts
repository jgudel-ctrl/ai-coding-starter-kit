/**
 * Echter Sync-Test: Lädt Rechnungen ab 2023 in die Datenbank.
 * Usage:
 *   EASYBILL_API_KEY=xxx \
 *   SUPABASE_URL=xxx \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/test-real-sync.ts
 */

import { createClient } from "@supabase/supabase-js";

const API_KEY = process.env.EASYBILL_API_KEY;
if (!API_KEY) throw new Error("EASYBILL_API_KEY fehlt");

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) throw new Error("SUPABASE_URL fehlt");

const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");

const BASE_URL = "https://api.easybill.de/rest/v1";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: "tms" },
});

async function easybillFetch<T>(endpoint: string): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(`Easybill ${response.status}`);
  return response.json();
}

function calcStatus(paid: number, total: number, due: string | null): string {
  if (paid >= total) return "paid";
  if (paid > 0) return "partial";
  if (due) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(due) < today) return "overdue";
  }
  return "open";
}

async function main() {
  console.log("🚀 Starte echten Sync-Test (max. 3 Seiten)...\n");

  let fetched = 0, inserted = 0, itemsTotal = 0, errors = 0;

  for (let page = 1; page <= 3; page++) {
    console.log(`📄 Seite ${page}...`);
    const data = await easybillFetch<any>(
      `/documents?limit=100&page=${page}&is_draft=false&type=INVOICE,CREDIT,STORNO,STORNO_CREDIT&edited_at=2023-01-01,9999-12-31`
    );

    const docs2023 = (data.items || []).filter((d: any) => new Date(d.document_date).getFullYear() >= 2023);
    console.log(`   ${docs2023.length} Dokumente ab 2023`);
    fetched += docs2023.length;

    for (const doc of docs2023.slice(0, 5)) {
      try {
        const status = calcStatus(doc.paid_amount||0, doc.amount||0, doc.due_date);

        await supabase.from("invoices").upsert({
          id: doc.id,
          invoice_number: doc.number,
          type: doc.type,
          document_date: doc.document_date,
          due_date: doc.due_date,
          customer_id: doc.customer_id,
          partner_name: doc.address?.company_name || doc.address?.last_name,
          amount: doc.amount,
          amount_net: doc.amount_net,
          paid_amount: doc.paid_amount,
          currency: doc.currency,
          payment_status: status,
          paid_at: doc.paid_at,
          created_at: doc.created_at,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: "id" });
        inserted++;

        // Positionen
        if (doc.items?.length > 0) {
          const items = doc.items.map((item: any) => ({
            id: item.id, invoice_id: doc.id, position: item.position,
            type: item.type, item_type: item.itemType,
            article_number: item.number, description: item.description,
            quantity: item.quantity, unit: item.unit,
            single_price_net: item.single_price_net, total_price_net: item.total_price_net,
            vat_percent: item.vat_percent, last_synced_at: new Date().toISOString(),
          }));
          await supabase.from("invoice_items").upsert(items, { onConflict: "id" });
          itemsTotal += items.length;
        }
      } catch (e: any) {
        console.error(`   ❌ Doc ${doc.id}:`, e.message);
        errors++;
      }
    }

    if (page < 3) await new Promise(r => setTimeout(r, 1000));
  }

  console.log("\n✅ Test abgeschlossen!");
  console.log(`   Geladen: ${fetched}`);
  console.log(`   Gespeichert: ${inserted}`);
  console.log(`   Positionen: ${itemsTotal}`);
  console.log(`   Fehler: ${errors}`);

  // Check in DB
  const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
  console.log(`   In DB gesamt: ${count}`);
}

main().catch(console.error);
