/**
 * PROJ-25: Initial-Import aus Easybill
 * Artikel, Produktgruppen, Kundengruppen, Rabatte
 */

const fs = require('fs');

const envContent = fs.readFileSync('/home/botti/.openclaw/workspace/.env.production', 'utf8');
function getEnv(key) {
  const regex = new RegExp('^' + key + '=(.+)$', 'm');
  const match = envContent.match(regex);
  return match ? match[1].trim() : '';
}

const EASYBILL_API_KEY = getEnv('EASYBILL_API_KEY');
const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const AUTH_PREFIX = String.fromCharCode(66, 101, 97, 114, 101, 114) + ' ';

// ============================================================
// Easybill API
// ============================================================

async function easybillFetch(endpoint) {
  const url = 'https://api.easybill.de/rest/v1' + endpoint;
  const res = await fetch(url, {
    headers: {
      'Authorization': AUTH_PREFIX + EASYBILL_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (res.status === 429) {
    console.log('   ⏳ Rate limit, warte 3s...');
    await new Promise(r => setTimeout(r, 3000));
    return easybillFetch(endpoint);
  }
  if (!res.ok) throw new Error('Easybill ' + res.status + ': ' + await res.text());
  return res.json();
}

// ============================================================
// Supabase
// ============================================================

async function supabaseUpsert(table, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': AUTH_PREFIX + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Upsert ' + res.status + ': ' + await res.text());
  return true;
}

async function supabaseQuery(table, query) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?' + query, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': AUTH_PREFIX + SUPABASE_KEY,
    },
  });
  if (!res.ok) throw new Error('Query ' + res.status);
  return res.json();
}

// ============================================================
// Import
// ============================================================

async function importPositionGroups() {
  console.log('\n📦 1. Produktgruppen...');
  const data = await easybillFetch('/position-groups?limit=1000');
  const groups = data.items || [];
  console.log('   Gefunden:', groups.length);
  
  const rows = groups.map(g => ({
    id: g.id,
    number: g.number || null,
    name: g.name || null,
    display_name: g.display_name || null,
    description: g.description || null,
  }));
  
  if (rows.length > 0) await supabaseUpsert('position_groups', rows);
  console.log('   ✅', rows.length, 'gespeichert');
  return groups.length;
}

async function importCustomerGroups() {
  console.log('\n👥 2. Kundengruppen...');
  const data = await easybillFetch('/customer-groups?limit=100');
  const groups = data.items || [];
  console.log('   Gefunden:', groups.length);
  
  const rows = groups.map(g => ({
    id: g.id,
    number: g.number || null,
    name: g.name || null,
    display_name: g.display_name || null,
  }));
  
  if (rows.length > 0) await supabaseUpsert('customer_groups', rows);
  console.log('   ✅', rows.length, 'gespeichert');
  return groups.length;
}

async function importProducts() {
  console.log('\n🔧 3. Artikel (7.315, ~8 Seiten)...');
  
  let page = 1;
  let total = 0;
  let imported = 0;
  
  while (true) {
    const data = await easybillFetch('/positions?limit=1000&page=' + page);
    const items = data.items || [];
    if (items.length === 0) break;
    if (page === 1) total = data.total || 0;
    
    const rows = items.map(p => ({
      id: p.id,
      number: p.number || null,
      description: p.description || null,
      type: p.type || null,
      group_id: p.group_id || null,
      cost_price: p.cost_price || null,
      sale_price: p.sale_price || null,
      vat_percent: p.vat_percent || null,
      unit: p.unit || null,
      archived: p.archived || false,
      note: p.note || null,
      raw_easybill_payload: p,
    }));
    
    await supabaseUpsert('products', rows);
    imported += items.length;
    
    const pct = total > 0 ? ((imported / total) * 100).toFixed(1) : '?';
    process.stdout.write('   Seite ' + page + ': ' + imported + '/' + total + ' (' + pct + '%)      \r');
    
    if (page >= data.pages) break;
    page++;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n   ✅', imported, 'Artikel importiert');
  return imported;
}

async function importDiscounts() {
  console.log('\n💰 4. Rabatte...');
  const data = await easybillFetch('/discounts/position-group?limit=1000');
  const discounts = data.items || [];
  console.log('   Gefunden:', discounts.length);
  
  const rows = [];
  let skipped = 0;
  
  for (const d of discounts) {
    const partners = await supabaseQuery(
      'partners',
      'easybill_id=eq.' + d.customer_id + '&select=id'
    );
    if (!partners || partners.length === 0) {
      skipped++;
      continue;
    }
    
    rows.push({
      partner_id: partners[0].id,
      easybill_discount_id: d.id,
      position_group_id: d.position_group_id || null,
      discount_percent: d.discount || null,
      discount_type: d.discount_type || null,
      raw_easybill_payload: d,
    });
  }
  
  if (rows.length > 0) await supabaseUpsert('partner_discounts', rows);
  
  console.log('   ✅', rows.length, 'Rabatte' + (skipped > 0 ? ' (' + skipped + ' ohne Partner)' : ''));
  return rows.length;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('🚀 PROJ-25: Initial-Import\n');
  const startTime = Date.now();
  
  try {
    const g = await importPositionGroups();
    await new Promise(r => setTimeout(r, 1000));
    
    const c = await importCustomerGroups();
    await new Promise(r => setTimeout(r, 1000));
    
    const p = await importProducts();
    await new Promise(r => setTimeout(r, 1000));
    
    const d = await importDiscounts();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n📋 ERGEBNIS (' + duration + 's)');
    console.log('Produktgruppen:', g);
    console.log('Kundengruppen: ', c);
    console.log('Artikel:       ', p);
    console.log('Rabatte:       ', d);
    
  } catch (err) {
    console.error('\n❌ Fehler:', err.message);
    process.exit(1);
  }
}

main();
