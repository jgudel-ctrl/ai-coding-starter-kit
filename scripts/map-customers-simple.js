/**
 * Holt Easybill-Kunden und matched sie mit Partnern
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

async function main() {
  console.log('🚀 Kunden-Mapping starten...\n');

  // Hole alle Easybill-Kunden
  const res = await fetch('https://api.easybill.de/rest/v1/customers?limit=1000', {
    headers: { Authorization: `Bearer ${EAK}` },
  });
  const data = await res.json();

  console.log(`📄 ${data.items?.length || 0} Kunden von Easybill\n`);

  // Mapping: customer_number → easybill_customer_id
  const mapping = {};
  for (const c of data.items || []) {
    if (c.number && c.id) {
      mapping[c.number] = c.id;
    }
  }

  console.log(`📝 ${Object.keys(mapping).length} Kundennummern gemapped\n`);

  // Hole Partner mit easybill_customer_number (nicht leer)
  const partnersRes = runSql(`
    SELECT id::text, easybill_customer_number 
    FROM tms.partners 
    WHERE easybill_customer_number IS NOT NULL 
      AND easybill_customer_number != ''
      AND easybill_customer_id IS NULL;
  `);

  if (!partnersRes.ok || !partnersRes.result) {
    console.log('ℹ️ Keine Partner zum Mappen gefunden oder Fehler.');
    console.log('Ergebnis:', partnersRes.result || partnersRes.error);
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
      else console.error(`❌ Update Fehler: ${r.error.substring(0, 100)}`);
    } else {
      notFound++;
    }
  }

  console.log('✅ MAPPING ABGESCHLOSSEN');
  console.log(`   Aktualisiert: ${updated}`);
  console.log(`   Nicht gefunden: ${notFound}`);

  // Ergebnis
  const check = runSql('SELECT COUNT(*) FROM tms.partners WHERE easybill_customer_id IS NOT NULL;');
  console.log(`\n💾 Partner mit easybill_customer_id: ${check.ok ? check.result : 'Fehler'}`);
}

main().catch(console.error);
