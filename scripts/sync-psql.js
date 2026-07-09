const { execSync } = require('child_process');

const EAK = proces…KEY;
const SUPABASE_DB = 'postgres://postgres@localhost:5432/postgres';

if (!EAK) {
  console.error('EASYBILL_API_KEY fehlt');
  process.exit(1);
}

async function easybillFetch(endpoint) {
  const res = await fetch(`https://api.easybill.de/rest/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${EAK}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Easybill ${res.status}`);
  return res.json();
}

function escapeSql(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return escapeSql(JSON.stringify(v));
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function calcStatus(paid, total, due) {
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  if (due) {
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(due) < today) return 'overdue';
  }
  return 'open';
}

function runSql(sql) {
  try {
    const result = execSync(`docker exec -i supabase-db psql -U postgres -d postgres -c "${sql.replace(/"/g, '\\"')}"`, {
      encoding: 'utf8',
      timeout: 30000,
    });
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
}

async function main() {
  console.log('🚀 Direct DB Sync via psql\n');

  const types = 'INVOICE,CREDIT,STORNO,STORNO_CREDIT';
  const data = await easybillFetch(`/documents?limit=5&page=1300&is_draft=false&type=${types}`);

  const docs = (data.items || []).filter(d => new Date(d.document_date).getFullYear() >= 2023);
  console.log(`📄 ${docs.length} Dokumente ab 2023 gefunden\n`);

  let inserted = 0, itemsTotal = 0, errors = 0;

  for (const doc of docs) {
    const status = calcStatus(doc.paid_amount || 0, doc.amount || 0, doc.due_date);
    const partnerName = doc.address?.company_name || doc.address?.last_name || '';

    // Invoice INSERT
    const invoiceSql = `
      INSERT INTO tms.invoices (
        id, invoice_number, type, document_date, due_date, customer_id,
        partner_name, amount, amount_net, paid_amount, currency,
        payment_status, paid_at, order_number, address, created_at, last_synced_at
      ) VALUES (
        ${doc.id},
        ${escapeSql(doc.number)},
        ${escapeSql(doc.type)},
        ${escapeSql(doc.document_date)},
        ${doc.due_date ? escapeSql(doc.due_date) : 'NULL'},
        ${doc.customer_id || 'NULL'},
        ${escapeSql(partnerName)},
        ${doc.amount || 0},
        ${doc.amount_net || 0},
        ${doc.paid_amount || 0},
        ${escapeSql(doc.currency || 'EUR')},
        ${escapeSql(status)},
        ${doc.paid_at ? escapeSql(doc.paid_at) : 'NULL'},
        ${doc.order_number ? escapeSql(doc.order_number) : 'NULL'},
        ${escapeSql(doc.address)},
        ${escapeSql(doc.created_at)},
        ${escapeSql(new Date().toISOString())}
      )
      ON CONFLICT (id) DO UPDATE SET
        invoice_number = EXCLUDED.invoice_number,
        type = EXCLUDED.type,
        document_date = EXCLUDED.document_date,
        due_date = EXCLUDED.due_date,
        customer_id = EXCLUDED.customer_id,
        partner_name = EXCLUDED.partner_name,
        amount = EXCLUDED.amount,
        amount_net = EXCLUDED.amount_net,
        paid_amount = EXCLUDED.paid_amount,
        currency = EXCLUDED.currency,
        payment_status = EXCLUDED.payment_status,
        paid_at = EXCLUDED.paid_at,
        order_number = EXCLUDED.order_number,
        address = EXCLUDED.address,
        last_synced_at = EXCLUDED.last_synced_at;
    `;

    const r1 = runSql(invoiceSql);
    if (!r1.ok) {
      console.error(`❌ Invoice ${doc.number} Fehler:`, r1.error);
      errors++;
      continue;
    }
    inserted++;

    // Items INSERT
    if (doc.items?.length > 0) {
      const itemsValues = doc.items.map(item => `(
        ${item.id},
        ${doc.id},
        ${item.position},
        ${escapeSql(item.type)},
        ${escapeSql(item.itemType)},
        ${escapeSql(item.number)},
        ${escapeSql(item.description)},
        ${item.quantity || 0},
        ${escapeSql(item.unit)},
        ${item.single_price_net || 0},
        ${item.total_price_net || 0},
        ${item.vat_percent || 0},
        ${escapeSql(new Date().toISOString())}
      )`).join(',\n');

      const itemsSql = `
        INSERT INTO tms.invoice_items (
          id, invoice_id, position, type, item_type, article_number,
          description, quantity, unit, single_price_net, total_price_net,
          vat_percent, last_synced_at
        ) VALUES ${itemsValues}
        ON CONFLICT (id) DO UPDATE SET
          invoice_id = EXCLUDED.invoice_id,
          position = EXCLUDED.position,
          type = EXCLUDED.type,
          item_type = EXCLUDED.item_type,
          article_number = EXCLUDED.article_number,
          description = EXCLUDED.description,
          quantity = EXCLUDED.quantity,
          unit = EXCLUDED.unit,
          single_price_net = EXCLUDED.single_price_net,
          total_price_net = EXCLUDED.total_price_net,
          vat_percent = EXCLUDED.vat_percent,
          last_synced_at = EXCLUDED.last_synced_at;
      `;

      const r2 = runSql(itemsSql);
      if (!r2.ok) {
        console.error(`⚠️ Items ${doc.number} Fehler:`, r2.error);
      } else {
        itemsTotal += doc.items.length;
      }
    }

    console.log(`✅ ${doc.number} — ${status} — ${doc.items?.length || 0} Positionen`);

    // Rate-Limit-Schutz
    await new Promise(r => setTimeout(r, 500));
  }

  // Sync-Log
  const logSql = `
    INSERT INTO tms.invoice_sync_log (
      sync_type, documents_fetched, documents_inserted, documents_updated,
      items_inserted, payments_inserted, started_at, completed_at, status, error_message
    ) VALUES (
      'manual_test_psql', ${docs.length}, ${inserted}, 0,
      ${itemsTotal}, 0,
      ${escapeSql(new Date().toISOString())},
      ${escapeSql(new Date().toISOString())},
      ${escapeSql(errors > 0 ? 'partial' : 'completed')},
      ${errors > 0 ? escapeSql(`${errors} Fehler`) : 'NULL'}
    );
  `;
  runSql(logSql);

  console.log('\n📊 Zusammenfassung:');
  console.log(`   Gespeichert: ${inserted}`);
  console.log(`   Positionen: ${itemsTotal}`);
  console.log(`   Fehler: ${errors}`);

  const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true });
  console.log(`\n💾 Invoices in DB gesamt: ${count}`);
}

main().catch(console.error);
