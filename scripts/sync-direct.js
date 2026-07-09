/**
 * Direct DB Sync via psql (stdin statt Kommandozeile)
 */

const { execSync } = require('child_process');

const EAK = process.env.EASYBILL_API_KEY;
if (!EAK) throw new Error('EASYBILL_API_KEY fehlt');

function runSql(sql) {
  try {
    // SQL über stdin an psql übergeben (vermeidet Shell-Escaping-Probleme)
    const result = execSync(
      'docker exec -i supabase-db psql -U postgres -d postgres',
      {
        encoding: 'utf8',
        timeout: 30000,
        input: sql,
      }
    );
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return esc(JSON.stringify(v));
  // Double-single-quote für SQL escaping
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function calcStatus(paid, total, due) {
  if ((paid || 0) >= (total || 0)) return 'paid';
  if ((paid || 0) > 0) return 'partial';
  if (due) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(due) < today) return 'overdue';
  }
  return 'open';
}

async function easybillFetch(endpoint) {
  const res = await fetch(`https://api.easybill.de/rest/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${EAK}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Easybill ${res.status}`);
  return res.json();
}

async function main() {
  console.log('🚀 Sync via psql (stdin)\n');

  const types = 'INVOICE,CREDIT,STORNO,STORNO_CREDIT';
  const data = await easybillFetch(`/documents?limit=5&page=1300&is_draft=false&type=${types}`);

  const docs = (data.items || []).filter(d => new Date(d.document_date).getFullYear() >= 2023);
  console.log(`📄 ${docs.length} Dokumente ab 2023\n`);

  let inserted = 0, itemsTotal = 0, errors = 0;

  for (const doc of docs) {
    const status = calcStatus(doc.paid_amount || 0, doc.amount || 0, doc.due_date);
    const partnerName = (doc.address?.company_name || doc.address?.last_name || '').substring(0, 255);

    // Invoice SQL
    const invoiceSql = `INSERT INTO tms.invoices (id, invoice_number, type, document_date, due_date, customer_id, partner_name, amount, amount_net, paid_amount, currency, payment_status, paid_at, order_number, address, created_at, last_synced_at) VALUES (${doc.id}, ${esc(doc.number)}, ${esc(doc.type)}, ${esc(doc.document_date)}, ${doc.due_date ? esc(doc.due_date) : 'NULL'}, ${doc.customer_id || 'NULL'}, ${esc(partnerName)}, ${doc.amount || 0}, ${doc.amount_net || 0}, ${doc.paid_amount || 0}, ${esc(doc.currency || 'EUR')}, ${esc(status)}, ${doc.paid_at ? esc(doc.paid_at) : 'NULL'}, ${doc.order_number ? esc(doc.order_number) : 'NULL'}, ${esc(JSON.stringify(doc.address))}, ${esc(doc.created_at)}, ${esc(new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, document_date=EXCLUDED.document_date, due_date=EXCLUDED.due_date, customer_id=EXCLUDED.customer_id, partner_name=EXCLUDED.partner_name, amount=EXCLUDED.amount, amount_net=EXCLUDED.amount_net, paid_amount=EXCLUDED.paid_amount, currency=EXCLUDED.currency, payment_status=EXCLUDED.payment_status, paid_at=EXCLUDED.paid_at, order_number=EXCLUDED.order_number, address=EXCLUDED.address, last_synced_at=EXCLUDED.last_synced_at;`;

    const r1 = runSql(invoiceSql);
    if (!r1.ok) {
      console.error(`❌ Invoice ${doc.number}:`, r1.error.substring(0, 200));
      errors++;
      continue;
    }
    inserted++;

    // Items SQL
    if (doc.items?.length > 0) {
      const vals = doc.items.map(item => `(${item.id}, ${doc.id}, ${item.position}, ${esc(item.type)}, ${esc(item.itemType)}, ${esc(item.number)}, ${esc(item.description)}, ${item.quantity || 0}, ${esc(item.unit)}, ${item.single_price_net || 0}, ${item.total_price_net || 0}, ${item.vat_percent || 0}, ${esc(new Date().toISOString())})`).join(',');
      const itemsSql = `INSERT INTO tms.invoice_items (id, invoice_id, position, type, item_type, article_number, description, quantity, unit, single_price_net, total_price_net, vat_percent, last_synced_at) VALUES ${vals} ON CONFLICT (id) DO UPDATE SET invoice_id=EXCLUDED.invoice_id, position=EXCLUDED.position, type=EXCLUDED.type, item_type=EXCLUDED.item_type, article_number=EXCLUDED.article_number, description=EXCLUDED.description, quantity=EXCLUDED.quantity, unit=EXCLUDED.unit, single_price_net=EXCLUDED.single_price_net, total_price_net=EXCLUDED.total_price_net, vat_percent=EXCLUDED.vat_percent, last_synced_at=EXCLUDED.last_synced_at;`;

      const r2 = runSql(itemsSql);
      if (!r2.ok) {
        console.error(`⚠️ Items ${doc.number}:`, r2.error.substring(0, 200));
      } else {
        itemsTotal += doc.items.length;
      }
    }

    console.log(`✅ ${doc.number} — ${status} — ${doc.items?.length || 0} Positionen`);

    // Rate-Limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n📊 Zusammenfassung:');
  console.log(`   Gespeichert: ${inserted}`);
  console.log(`   Positionen: ${itemsTotal}`);
  console.log(`   Fehler: ${errors}`);

  const countResult = runSql('SELECT COUNT(*) FROM tms.invoices;');
  console.log(`\n💾 Invoices in DB: ${countResult.ok ? countResult.result.trim() : 'Fehler'}`);
}

main().catch(console.error);
