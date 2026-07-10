const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3Nzg2ODEwMTYsImV4cCI6MTkzNjM2MTAxNn0.OKObADZ0LYZS9dKS4El1ShwbBA6-BQH1a4hHKB9F5-M';

async function supabaseQuery(table, query = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table} query failed: ${res.status}`);
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
  if (!res.ok) throw new Error(`${table} patch failed: ${res.status}`);
  return true;
}

async function getAllPartners() {
  const all = [];
  let start = 0;
  while (true) {
    const batch = await supabaseQuery('partners',
      'is_active=eq.true&duplicate_of=is.null&select=id,display_name,company_name&order=created_at.asc',
      start, start + 999);
    if (!batch || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 1000) break;
    start += 1000;
  }
  return all;
}

async function checkForDuplicates(partner) {
  const addresses = await supabaseQuery(
    'partner_addresses',
    `partner_id=eq.${partner.id}&is_active=eq.true&select=address_type,street,postal_code,city`);
  const billingAddr = addresses.find(a => a.address_type === 'billing');
  const shippingAddr = addresses.find(a => a.address_type === 'shipping');
  if (!billingAddr && !shippingAddr) return { checked: true, duplicates: 0 };

  const dn = encodeURIComponent(partner.display_name || '');
  const cn = partner.company_name ? encodeURIComponent(partner.company_name) : null;
  const nameQuery = cn ? `or=(display_name.eq.${dn},company_name.eq.${cn})` : `display_name=eq.${dn}`;

  const candidates = await supabaseQuery('partners',
    `${nameQuery}&id=neq.${partner.id}&duplicate_of=is.null&is_active=eq.true&select=id,display_name`);
  if (!candidates?.length) return { checked: true, duplicates: 0 };

  for (const candidate of candidates) {
    const candAddr = await supabaseQuery('partner_addresses',
      `partner_id=eq.${candidate.id}&is_active=eq.true&select=address_type,street,postal_code,city`);
    const cb = candAddr.find(a => a.address_type === 'billing');
    const cs = candAddr.find(a => a.address_type === 'shipping');

    const sameB = billingAddr && cb && billingAddr.street === cb.street && billingAddr.postal_code === cb.postal_code;
    const sameS = shippingAddr && cs && shippingAddr.street === cs.street && shippingAddr.postal_code === cs.postal_code;

    if (sameB || sameS) {
      const pInv = await supabaseQuery('invoices', `partner_id=eq.${partner.id}&status=eq.paid&select=total_net`);
      const cInv = await supabaseQuery('invoices', `partner_id=eq.${candidate.id}&status=eq.paid&select=total_net`);
      const pRev = (pInv || []).reduce((s, i) => s + (i.total_net || 0), 0);
      const cRev = (cInv || []).reduce((s, i) => s + (i.total_net || 0), 0);

      if (pRev <= cRev) {
        await supabasePatch('partners', partner.id, {
          is_active: false, duplicate_of: candidate.id,
          duplicate_reason: `Auto: Same name/address. Revenue: ${pRev.toFixed(2)} vs ${cRev.toFixed(2)}`,
        });
        return { checked: true, duplicates: 1, deactivated: 'self' };
      } else {
        await supabasePatch('partners', candidate.id, {
          is_active: false, duplicate_of: partner.id,
          duplicate_reason: `Auto: Same name/address. Revenue: ${cRev.toFixed(2)} vs ${pRev.toFixed(2)}`,
        });
        return { checked: true, duplicates: 1, deactivated: 'candidate', candidateId: candidate.id };
      }
    }
  }
  return { checked: true, duplicates: 0 };
}

async function main() {
  console.log('🔍 Initial Dubletten-Check: Alle Partner...\n');
  const start = Date.now();
  
  const partners = await getAllPartners();
  console.log(`📊 ${partners.length} aktive Partner\n`);

  let checked = 0, dupFound = 0, selfDeac = 0, candDeac = 0;
  const deacList = [];

  for (let i = 0; i < partners.length; i++) {
    try {
      const r = await checkForDuplicates(partners[i]);
      checked++;
      if (r.duplicates > 0) {
        dupFound++;
        if (r.deactivated === 'self') { selfDeac++; console.log(`  ⚠️  ${partners[i].display_name} → SELBST deaktiviert`); }
        else { candDeac++; deacList.push(`${partners[i].display_name} → Kandidat ${r.candidateId}`); console.log(`  ⚠️  ${partners[i].display_name} → Kandidat deaktiviert`); }
      }
      if ((i + 1) % 100 === 0) console.log(`  ... ${i + 1}/${partners.length}`);
    } catch (e) { console.error(`  ❌ ${partners[i].display_name}: ${e.message}`); }
  }

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log('📋 ERGEBNIS');
  console.log(`Geprüft:              ${checked}/${partners.length}`);
  console.log(`Dubletten gefunden:   ${dupFound}`);
  console.log(`- Selbst deaktiviert: ${selfDeac}`);
  console.log(`- Kandidat deaktiv.:  ${candDeac}`);
  console.log(`Dauer:                ${dur}s`);
  if (deacList.length > 0) { console.log('\nDeaktivierte Kandidaten:'); deacList.forEach(d => console.log(`  - ${d}`)); }
  console.log('='.repeat(50));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
