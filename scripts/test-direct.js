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

async function easybillFetch(endpoint) {
  const url = 'https://api.easybill.de/rest/v1' + endpoint;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Bearer ' + EASYBILL_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(res.status + ': ' + await res.text());
  return res.json();
}

async function supabaseUpsert(table, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Upsert ' + res.status + ': ' + text);
  }
  // merge-duplicates gibt oft leere Antwort (204)
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

(async () => {
  try {
    console.log('1. Produktgruppen...');
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
  } catch (e) {
    console.error('❌ Fehler:', e.message);
  }
})();
