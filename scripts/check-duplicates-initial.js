// 🔍 Initial Dubletten-Check: Alle aktiven Partner
// → Namen: lowercase + zusammengeschrieben (keine Leerzeichen, Kommas, etc.)
// → Adressen: Straße + PLZ normalisiert
// → Revenue: amount_net (Cent → Euro)

const fs = require('fs');

// Supabase-Key aus .env.production lesen
const envContent = fs.readFileSync('/home/botti/.openclaw/workspace/.env.production', 'utf8');
const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
// Service-Role-Key (volle Rechte auf alle Tabellen)
const SUPABASE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY nicht gefunden in .env.production');

async function supabaseQuery(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table} query failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabasePatch(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`${table} patch failed: ${res.status} ${await res.text()}`);
  return true;
}

// Alles auf einmal laden (Pagination)
async function fetchAll(table, queryBase) {
  const all = [];
  let start = 0;
  const LIMIT = 1000;
  while (true) {
    const batch = await supabaseQuery(table, `${queryBase}&limit=${LIMIT}&offset=${start}`);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < LIMIT) break;
    start += LIMIT;
  }
  return all;
}

// Name normalisieren: lowercase, nur Buchstaben/Zahlen, zusammengeschrieben
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-zäöüß0-9]/gi, '')  // alles raus außer Buchstaben/Zahlen
    .trim();
}

// Adresse normalisieren
function normalizeAddress(street, postalCode) {
  const s = normalize(street || '');
  const p = (postalCode || '').replace(/\D/g, ''); // nur Ziffern
  return s + p;
}

async function main() {
  console.log('🔍 Initial Dubletten-Check: Alle aktiven Partner...');
  console.log('   → Namen: lowercase + zusammengeschrieben');
  console.log('   → Adressen: Straße + PLZ normalisiert');
  console.log('   → Revenue: amount_net (Cent → Euro)\n');

  const start = Date.now();

  // 1. Partner laden
  console.log('📥 Lade Partner...');
  const partners = await fetchAll('partners',
    'is_active=eq.true&duplicate_of=is.null&select=id,display_name,company_name,created_at&order=created_at.asc');
  console.log(`   ✅ ${partners.length} Partner\n`);

  // 2. Adressen laden
  console.log('📥 Lade Adressen...');
  const addresses = await fetchAll('partner_addresses',
    'is_active=eq.true&select=partner_id,address_type,street,postal_code,city');
  console.log(`   ✅ ${addresses.length} Adressen\n`);

  // 3. Rechnungen laden
  console.log('📥 Lade Rechnungen (paid)...');
  const invoices = await fetchAll('invoices',
    'status=eq.paid&select=partner_id,amount_net');
  console.log(`   ✅ ${invoices.length} Rechnungen\n`);

  // 4. Revenue pro Partner summieren (Cent → Euro)
  const revenue = {};
  for (const inv of invoices) {
    if (inv.partner_id) {
      revenue[inv.partner_id] = (revenue[inv.partner_id] || 0) + (inv.amount_net || 0);
    }
  }

  // 5. Adressen pro Partner indexieren
  const partnerAddrs = {};
  for (const addr of addresses) {
    if (!partnerAddrs[addr.partner_id]) partnerAddrs[addr.partner_id] = [];
    partnerAddrs[addr.partner_id].push(addr);
  }

  // 6. Partner nach normalisiertem Namen gruppieren
  const byName = {};
  for (const p of partners) {
    const key = normalize(p.company_name || p.display_name || '');
    if (!key) continue;
    if (!byName[key]) byName[key] = [];
    byName[key].push(p);
  }

  const multiNames = Object.entries(byName).filter(([_, g]) => g.length >= 2);
  console.log(`📊 Eindeutige Namen: ${Object.keys(byName).length}`);
  console.log(`📊 Namen mit ≥2 Partnern: ${multiNames.length} (potenzielle Dubletten)\n`);

  // 7. Dubletten-Check
  let checked = 0, dupFound = 0, selfDeac = 0, candDeac = 0;
  const deacList = [];

  for (const [, group] of multiNames) {
    // Alle Paare innerhalb der Gruppe vergleichen
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        checked++;
        const p1 = group[i];
        const p2 = group[j];

        // Adressen holen
        const a1 = partnerAddrs[p1.id] || [];
        const a2 = partnerAddrs[p2.id] || [];

        const b1 = a1.find(a => a.address_type === 'billing');
        const s1 = a1.find(a => a.address_type === 'shipping');
        const b2 = a2.find(a => a.address_type === 'billing');
        const s2 = a2.find(a => a.address_type === 'shipping');

        const b1Key = b1 ? normalizeAddress(b1.street, b1.postal_code) : null;
        const s1Key = s1 ? normalizeAddress(s1.street, s1.postal_code) : null;
        const b2Key = b2 ? normalizeAddress(b2.street, b2.postal_code) : null;
        const s2Key = s2 ? normalizeAddress(s2.street, s2.postal_code) : null;

        const sameB = b1Key && b2Key && b1Key === b2Key && b1Key !== '';
        const sameS = s1Key && s2Key && s1Key === s2Key && s1Key !== '';

        if (sameB || sameS) {
          dupFound++;

          // Revenue vergleichen (Cent → Euro)
          const r1 = (revenue[p1.id] || 0) / 100;
          const r2 = (revenue[p2.id] || 0) / 100;

          if (r1 <= r2) {
            await supabasePatch('partners', p1.id, {
              is_active: false,
              duplicate_of: p2.id,
              duplicate_reason: `Auto: Same normalized name/address. Revenue: €${r1.toFixed(2)} vs €${r2.toFixed(2)}`,
            });
            selfDeac++;
            deacList.push(`${p1.display_name} → ${p2.display_name} (€${r1.toFixed(2)} vs €${r2.toFixed(2)})`);
            console.log(`  ⚠️  "${p1.display_name}" DEAKTIVIERT → "${p2.display_name}" (€${r1.toFixed(2)} vs €${r2.toFixed(2)})`);
            // p1 ist jetzt inaktiv, nicht mehr mit anderen vergleichen
            break;
          } else {
            await supabasePatch('partners', p2.id, {
              is_active: false,
              duplicate_of: p1.id,
              duplicate_reason: `Auto: Same normalized name/address. Revenue: €${r2.toFixed(2)} vs €${r1.toFixed(2)}`,
            });
            candDeac++;
            deacList.push(`${p2.display_name} → ${p1.display_name} (€${r2.toFixed(2)} vs €${r1.toFixed(2)})`);
            console.log(`  ⚠️  "${p2.display_name}" DEAKTIVIERT → "${p1.display_name}" (€${r2.toFixed(2)} vs €${r1.toFixed(2)})`);
          }
        }
      }
    }
  }

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(55));
  console.log('📋 ERGEBNIS');
  console.log(`Verglichen:           ${checked} Paare`);
  console.log(`Dubletten gefunden:   ${dupFound}`);
  console.log(`- Selbst deaktiviert: ${selfDeac}`);
  console.log(`- Kandidat deaktiv.:  ${candDeac}`);
  console.log(`Dauer:                ${dur}s`);
  if (deacList.length > 0) {
    console.log('\n📋 Deaktivierte Partner:');
    deacList.forEach(d => console.log(`  • ${d}`));
  }
  console.log('='.repeat(55));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
