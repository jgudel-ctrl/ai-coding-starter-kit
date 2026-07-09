/**
 * Holt alle Easybill-Kunden und matched sie mit unseren Partnern
 * über easybill_customer_number → customer_id Mapping
 */
const { execSync } = require('child_process');

const EAK = process.env.EASYBILL_API_KEY;
if (!EAK) throw new Error('EASYBILL_API_KEY fehlt');

async function easybillFetch(endpoint) {
  const res = await fetch(`https://api.easybill.de/rest/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${EAK}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Easybill ${res.status}: ${await res.text()}`);
  return res.json();
}

function runSql(sql) {
  try {
    const result = execSync(
      'docker exec -i supabase-db psql -U supabase_admin -d postgres',
      { encoding: 'utf8', timeout: 30000, input: sql }
    );
    return { ok: true, result };
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

  // 1. Hole alle Easybill-Kunden
  const customers = await easybillFetch('/customers?limit=1000');
  console.log(`📄 ${customers.items?.length || 0} Kunden von Easybill geladen\n`);

  // 2. Baue Mapping: customer_number → id
  const mapping = {};
  for (const c of customers.items || []) {
    if (c.number) {
      mapping[String(c.number)] = c.id;
    }
  }
  console.log(`📝 ${Object.keys(mapping).length} Kundennummern gemapped\n`);

  // 3. Hole unsere Partner mit easybill_customer_number
  const partnersResult = runSql(`
    SELECT id, easybill_customer_number 
    FROM tms.partners 
    WHERE easybill_customer_number IS NOT NULL 
      AND easybill_customer_number != ''
      AND easybill_customer_id IS NULL;
  `);

  if (!partnersResult.ok) {
    console.error('❌ Fehler beim Abrufen der Partner:', partnersResult.error);
    return;
  }

  // Parse Partner (Format: id | easybill_customer_number)
  const lines = partnersResult.result.trim().split('\n').filter(l => l.includes('|'));
  console.log(`👥 ${lines.length} Partner ohne easybill_customer_id gefunden\n`);

  let updated = 0, notFound = 0;

  for (const line of lines) {
    const parts = line.split('|').map(s => s.trim());
    if (parts.length < 2) continue;

    const partnerId = parts[0];
    const customerNumber = parts[1];

    const easybillId = mapping[customerNumber];
    if (easybillId) {
      const updateResult = runSql(`
        UPDATE tms.partners 
        SET easybill_customer_id = ${easybillId} 
        WHERE id = ${esc(partnerId)};
      `);
      if (updateResult.ok) {
        updated++;
      } else {
        console.error(`❌ Update Fehler für Partner ${partnerId}:`, updateResult.error);
      }
    } else {
      notFound++;
    }
  }

  console.log('✅ MAPPING ABGESCHLOSSEN');
  console.log(`   Aktualisiert: ${updated} Partner`);
  console.log(`   Nicht gefunden: ${notFound} Partner`);

  // 4. Prüfe Ergebnis
  const checkResult = runSql(`
    SELECT COUNT(*) as mit_id FROM tms.partners WHERE easybill_customer_id IS NOT NULL;
  `);
  console.log(`\n💾 Partner mit easybill_customer_id: ${checkResult.ok ? checkResult.result.trim() : 'Fehler'}`);
}

main().catch(err => { console.error('💥 Fehler:', err); process.exit(1); });
