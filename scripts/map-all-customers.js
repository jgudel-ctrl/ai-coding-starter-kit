/**
 * Holt ALLE Easybill-Kunden (alle Seiten) und matched sie mit Partnern
 */
const { execSync } = require('child_process');

const EAK = process.env.EASYBILL_API_KEY;
if (!EAK) throw new Error('EASYBILL_API_KEY fehlt');

function runSql(sql) {
  try {
    const result = execSync(
      'docker exec -i supabase-db psql -U supabase_admin -d postgres -A -t',
      { encoding: 'utf8', timeout: 30000, input: sql }
    );
    return { ok: true, result: result.trim() };
  } catch (e) {
    return { ok: false, error: e.stderr || e.message };
  }
}

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function easybillFetch(endpoint) {
  const res = await fetch(`https://api.easybill.de/rest/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${EAK}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) {
    console.log('⏳ Rate-Limit, warte 5s...');
    await new Promise(r => setTimeout(r, 5000));
    return easybillFetch(endpoint);
  }
  if (!res.ok) throw new Error(`Easybill ${res.status}`);
  return res.json();
}

async function main() {
  console.log('🚀 Lade ALLE Easybill-Kunden...\n');

  // 1. Hole alle Kunden (paginiert)
  const mapping = {};
  let page = 1;
  let totalPages = 1;

  do {
    const data = await easybillFetch(`/customers?limit=1000&page=${page}`);
    for (const c of data.items || []) {
      if (c.number && c.id) {
        mapping[c.number] = c.id;
      }
    }
    totalPages = data.pages || 1;
    console.log(`📄 Seite ${page}/${totalPages}: ${data.items?.length || 0} Kunden geladen`);
    page++;
    if (page <= totalPages) await new Promise(r => setTimeout(r, 500));
  } while (page <= totalPages);

  console.log(`\n📝 ${Object.keys(mapping).length} Kundennummern insgesamt gemapped\n`);

  // 2. Hole Partner
  const partnersRes = runSql(`
    SELECT id::text, easybill_customer_number 
    FROM tms.partners 
    WHERE easybill_customer_number IS NOT NULL 
      AND easybill_customer_number != ''
      AND easybill_customer_id IS NULL;
  `);

  if (!partnersRes.ok || !partnersRes.result) {
    console.log('ℹ️ Keine Partner zum Mappen gefunden.');
    return;
  }

  const lines = partnersRes.result.split('\n').filter(l => l.includes('|'));
  console.log(`👥 ${lines.length} Partner ohne easybill_customer_id\n`);

  let updated = 0, notFound = 0;

  for (const line of lines) {
    const [partnerId, customerNumber] = line.split('|').map(s => s.trim());
    if (!partnerId || !customerNumber) continue;

    const easybillId = mapping[customerNumber];
    if (easybillId) {
      const r = runSql(`UPDATE tms.partners SET easybill_customer_id = ${easybillId} WHERE id = ${esc(partnerId)};`);
      if (r.ok) updated++;
      else console.error(`❌ Fehler: ${r.error.substring(0, 100)}`);
    } else {
      notFound++;
    }
  }

  console.log('\n✅ MAPPING ABGESCHLOSSEN');
  console.log(`   Aktualisiert: ${updated}`);
  console.log(`   Nicht gefunden: ${notFound}`);

  const check = runSql('SELECT COUNT(*) FROM tms.partners WHERE easybill_customer_id IS NOT NULL;');
  console.log(`\n💾 Partner mit easybill_customer_id: ${check.ok ? check.result : 'Fehler'}`);
}

main().catch(console.error);
