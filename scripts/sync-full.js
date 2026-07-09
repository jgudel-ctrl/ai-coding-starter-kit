/**
 * Vollständiger Invoice-Sync (ab 2023) via psql (bypass RLS)
 * Läuft im Hintergrund, loggt Fortschritt nach stdout/stderr
 * V2: Robuster — UNIQUE constraint OK, NULL descriptions OK
 */

const { execSync } = require('child_process');

const EAK = process.env.EASYBILL_API_KEY;
if (!EAK) throw new Error('EASYBILL_API_KEY fehlt');

const BATCH_SIZE = 100;
const PAUSE_MS = 1000;

let totalDocs = 0, savedDocs = 0, savedItems = 0, errors = 0;
let currentPage = 1;
let shouldStop = false;

process.on('SIGINT', () => { console.log('\n🛑 Abbruch...'); shouldStop = true; });

function runSql(sql) {
  try {
    const result = execSync(
      'docker exec -i supabase-db psql -U postgres -d postgres',
      { encoding: 'utf8', timeout: 30000, input: sql }
    );
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'object') return esc(JSON.stringify(v));
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function calcStatus(paid, total, due) {
  if ((paid || 0) >= (total || 0)) return 'paid';
  if ((paid || 0) > 0) return 'partial';
  if (due) { const today = new Date(); today.setHours(0,0,0,0); if (new Date(due) < today) return 'overdue'; }
  return 'open';
}

async function easybillFetch(endpoint) {
  const res = await fetch(`https://api.easybill.de/rest/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${EAK}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) {
    console.log('⏳ Rate-Limit erreicht, warte 5s...');
    await new Promise(r => setTimeout(r, 5000));
    return easybillFetch(endpoint);
  }
  if (!res.ok) throw new Error(`Easybill ${res.status}: ${await res.text()}`);
  return res.json();
}

async function processDocument(doc) {
  const docYear = new Date(doc.document_date).getFullYear();
  if (docYear < 2023) return { saved: false, skipped: true };

  const status = calcStatus(doc.paid_amount || 0, doc.amount || 0, doc.due_date);
  const partnerName = (doc.address?.company_name || doc.address?.last_name || '').substring(0, 255);

  // Invoice
  const invoiceSql = `INSERT INTO tms.invoices (id, invoice_number, type, document_date, due_date, customer_id, partner_name, amount, amount_net, paid_amount, currency, payment_status, paid_at, order_number, address, created_at, last_synced_at) VALUES (${doc.id}, ${esc(doc.number)}, ${esc(doc.type)}, ${esc(doc.document_date)}, ${doc.due_date ? esc(doc.due_date) : 'NULL'}, ${doc.customer_id || 'NULL'}, ${esc(partnerName)}, ${doc.amount || 0}, ${doc.amount_net || 0}, ${doc.paid_amount || 0}, ${esc(doc.currency || 'EUR')}, ${esc(status)}, ${doc.paid_at ? esc(doc.paid_at) : 'NULL'}, ${doc.order_number ? esc(doc.order_number) : 'NULL'}, ${esc(JSON.stringify(doc.address))}, ${esc(doc.created_at)}, ${esc(new Date().toISOString())}) ON CONFLICT (id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number, type=EXCLUDED.type, document_date=EXCLUDED.document_date, due_date=EXCLUDED.due_date, customer_id=EXCLUDED.customer_id, partner_name=EXCLUDED.partner_name, amount=EXCLUDED.amount, amount_net=EXCLUDED.amount_net, paid_amount=EXCLUDED.paid_amount, currency=EXCLUDED.currency, payment_status=EXCLUDED.payment_status, paid_at=EXCLUDED.paid_at, order_number=EXCLUDED.order_number, address=EXCLUDED.address, last_synced_at=EXCLUDED.last_synced_at;`;

  const r1 = runSql(invoiceSql);
  if (!r1.ok) {
    // Duplicate invoice_number+type ist OK — diese Nummer+Typ existiert schon
    if (r1.error.includes('uk_invoices_number_type')) {
      return { saved: false, skipped: true };
    }
    console.error(`❌ Invoice ${doc.number}: ${r1.error.substring(0, 150)}`);
    errors++;
    return { saved: false, skipped: false };
  }

  // Items
  let itemsInserted = 0;
  if (doc.items?.length > 0) {
    const vals = doc.items.map(item =>
      `(${item.id}, ${doc.id}, ${item.position}, ${esc(item.type)}, ${esc(item.itemType)}, ${esc(item.number)}, ${esc(item.description)}, ${item.quantity || 0}, ${esc(item.unit)}, ${item.single_price_net || 0}, ${item.total_price_net || 0}, ${item.vat_percent || 0}, ${esc(new Date().toISOString())})`
    ).join(',');
    const itemsSql = `INSERT INTO tms.invoice_items (id, invoice_id, position, type, item_type, article_number, description, quantity, unit, single_price_net, total_price_net, vat_percent, last_synced_at) VALUES ${vals} ON CONFLICT (id) DO UPDATE SET invoice_id=EXCLUDED.invoice_id, position=EXCLUDED.position, type=EXCLUDED.type, item_type=EXCLUDED.item_type, article_number=EXCLUDED.article_number, description=EXCLUDED.description, quantity=EXCLUDED.quantity, unit=EXCLUDED.unit, single_price_net=EXCLUDED.single_price_net, total_price_net=EXCLUDED.total_price_net, vat_percent=EXCLUDED.vat_percent, last_synced_at=EXCLUDED.last_synced_at;`;

    const r2 = runSql(itemsSql);
    if (!r2.ok) {
      // Foreign key violation = Invoice wurde übersprungen, ist OK
      if (r2.error.includes('invoice_items_invoice_id_fkey')) {
        // Ignorieren
      } else {
        console.error(`⚠️ Items ${doc.number}: ${r2.error.substring(0, 150)}`);
      }
    } else {
      itemsInserted = doc.items.length;
    }
  }

  return { saved: true, items: itemsInserted, skipped: false };
}

async function main() {
  console.log('🚀 VOLLSTÄNDIGER SYNC — Rechnungen ab 2023');
  console.log('═════════════════════════════════════════════');
  const startTime = Date.now();

  const types = 'INVOICE,CREDIT,STORNO,STORNO_CREDIT';

  // Erste Seite
  const firstPage = await easybillFetch(`/documents?limit=${BATCH_SIZE}&page=1&is_draft=false&type=${types}`);
  const totalPages = firstPage.pages || 1;
  console.log(`📄 Gesamt: ${firstPage.total} Dokumente, ${totalPages} Seiten`);
  console.log(`💾 Bereits in DB: Prüfe...\n`);

  // Seite 1
  for (const doc of firstPage.items || []) {
    if (shouldStop) break;
    const result = await processDocument(doc);
    if (result.saved) savedDocs++;
    if (result.skipped) { /* übersprungen */ }
    totalDocs++;
  }

  // Seiten 2 bis Ende
  for (currentPage = 2; currentPage <= totalPages; currentPage++) {
    if (shouldStop) break;

    const data = await easybillFetch(`/documents?limit=${BATCH_SIZE}&page=${currentPage}&is_draft=false&type=${types}`);
    const docs = data.items || [];
    if (docs.length === 0) break;

    for (const doc of docs) {
      if (shouldStop) break;
      const result = await processDocument(doc);
      if (result.saved) { savedDocs++; savedItems += result.items; }
      if (result.skipped) { /* übersprungen */ }
      totalDocs++;
    }

    // Fortschritt
    if (currentPage % 10 === 0 || currentPage === totalPages) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log(`⏱️  Seite ${currentPage}/${totalPages} | Gesamt: ${totalDocs} | Gespeichert: ${savedDocs} | Items: ${savedItems} | Fehler: ${errors} | ${elapsed}min`);
    }

    if (currentPage < totalPages) await new Promise(r => setTimeout(r, PAUSE_MS));
  }

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n═════════════════════════════════════════════');
  console.log('✅ SYNC ABGESCHLOSSEN');
  console.log(`   Dauer: ${totalMin} Minuten`);
  console.log(`   Geprüft: ${totalDocs}`);
  console.log(`   Gespeichert: ${savedDocs} Rechnungen`);
  console.log(`   Positionen: ${savedItems}`);
  console.log(`   Fehler: ${errors}`);

  // Sync-Log
  const logSql = `INSERT INTO tms.invoice_sync_log (sync_type, documents_fetched, documents_inserted, documents_updated, items_inserted, payments_inserted, started_at, completed_at, status, error_message) VALUES ('full_sync_v2', ${totalDocs}, ${savedDocs}, 0, ${savedItems}, 0, ${esc(new Date(startTime).toISOString())}, ${esc(new Date().toISOString())}, 'completed', NULL);`;
  runSql(logSql);
}

main().catch(err => { console.error('💥 Kritischer Fehler:', err); process.exit(1); });
