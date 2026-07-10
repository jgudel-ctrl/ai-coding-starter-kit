/**
 * PROJ-24: Massen-Geoapify-Validierung für bestehende Adressen
 * 
 * Läuft Batches von 100 Adressen, damit wir das Geoapify-Limit nicht sprengen.
 * Free Tier: ~3.000/Tag. Bei ~2.600 Adressen passt das.
 * 
 * Aufruf: node scripts/bulk-geoapify-validate.js
 */

const fs = require('fs');

const envPath = '/home/botti/.openclaw/workspace/.env.production';
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const regex = new RegExp('^' + key + '=(.+)$', 'm');
  const match = envContent.match(regex);
  return match ? match[1].trim() : '';
}

const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const GEOAPIFY_API_KEY = getEnv('GEOAPIFY_API_KEY');

if (!SUPABASE_KEY || !GEOAPIFY_API_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY oder GEOAPIFY_API_KEY fehlt');
  process.exit(1);
}

// ============================================================
// Supabase Queries
// ============================================================

async function supabaseQuery(table, query = '') {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': '***' + SUPABASE_KEY,
    },
  });
  if (!res.ok) throw new Error('Query failed: ' + res.status);
  return res.json();
}

async function supabaseUpdate(table, id, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=eq.' + id, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': '***' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Update failed: ' + res.status);
  return true;
}

// ============================================================
// Geoapify
// ============================================================

async function validateAddress(street, postalCode, city, country) {
  if (!street && !city) {
    return { status: 'invalid', confidence: 0 };
  }

  try {
    const addressParts = [street, city, country].filter(Boolean).join(', ');
    
    const url = new URL('https://api.geoapify.com/v1/geocode/search');
    url.searchParams.set('text', addressParts);
    url.searchParams.set('limit', '1');
    url.searchParams.set('format', 'json');
    url.searchParams.set('apiKey', GEOAPIFY_API_KEY);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return { status: 'error', confidence: null, errorMessage: 'HTTP ' + res.status };
    }

    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      return { status: 'invalid', confidence: 0 };
    }

    const result = data.results[0];
    const confidence = result.rank?.confidence || 0.8;

    const suggestedStreet = result.street 
      ? (result.street + ' ' + (result.housenumber || '')).trim() 
      : null;

    if (result.rank?.confidence === 1 || result.rank?.match_type === 'full_match') {
      return {
        status: 'valid',
        confidence: confidence,
        suggestedStreet: suggestedStreet,
        suggestedPostalCode: result.postcode || null,
        suggestedCity: result.city || result.county || null,
        suggestedCountry: result.country || null,
      };
    }

    return {
      status: 'suggestion',
      confidence: confidence,
      suggestedStreet: suggestedStreet,
      suggestedPostalCode: result.postcode || null,
      suggestedCity: result.city || result.county || null,
      suggestedCountry: result.country || null,
    };

  } catch (error) {
    return { status: 'error', confidence: null, errorMessage: error.message };
  }
}

// ============================================================
// Hauptfunktion
// ============================================================

async function main() {
  console.log('🌍 PROJ-24: Massen-Geoapify-Validierung\n');
  console.log('========================================');
  const startTime = Date.now();

  try {
    // 1. Alle Adressen ohne Geoapify-Eintrag holen
    console.log('\n📥 Lade Adressen ohne Validierung...');
    const addresses = await supabaseQuery(
      'partner_addresses',
      'select=id,street,postal_code,city,country'
        + '&geoapify_status=is.null'
        + '&is_active=eq.true'
        + '&limit=1000'
    );

    console.log('   Gefunden: ' + addresses.length + ' Adressen');

    if (addresses.length === 0) {
      console.log('✅ Alle Adressen sind bereits validiert!');
      return;
    }

    // 2. Batch-weise validieren (alle 200ms = max 5/sec)
    let processed = 0;
    let valid = 0;
    let suggestion = 0;
    let invalid = 0;
    let error = 0;
    const BATCH_SIZE = 100;
    const DELAY_MS = 200; // 200ms zwischen Anfragen = 5/sec

    console.log('\n🔄 Starte Validierung (Rate: 1 Adresse / ' + DELAY_MS + 'ms)...\n');

    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      
      // Rate Limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }

      // Fortschritt alle 50
      if (i % 50 === 0 && i > 0) {
        const pct = ((i / addresses.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        console.log('   [' + pct + '%] ' + i + '/' + addresses.length + ' (' + elapsed + 'min) — '
          + '✅' + valid + ' 🟡' + suggestion + ' 🔴' + invalid + ' ⚪' + error);
      }

      // Validieren
      const result = await validateAddress(addr.street, addr.postal_code, addr.city, addr.country);
      
      // Speichern
      await supabaseUpdate('partner_addresses', addr.id, {
        geoapify_status: result.status,
        geoapify_confidence: result.confidence,
        geoapify_suggested_street: result.suggestedStreet || null,
        geoapify_suggested_postal_code: result.suggestedPostalCode || null,
        geoapify_suggested_city: result.suggestedCity || null,
        geoapify_suggested_country: result.suggestedCountry || null,
        geoapify_validated_at: new Date().toISOString(),
      });

      // Statistik
      switch (result.status) {
        case 'valid': valid++; break;
        case 'suggestion': suggestion++; break;
        case 'invalid': invalid++; break;
        case 'error': error++; break;
      }
      processed++;

      // Batch-Pause (alle 100 Adressen 1 Sekunde extra)
      if (i > 0 && i % BATCH_SIZE === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Ergebnis
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log('\n========================================');
    console.log('📋 ERGEBNIS');
    console.log('========================================');
    console.log('Dauer:          ' + duration + ' Minuten');
    console.log('Verarbeitet:    ' + processed);
    console.log('');
    console.log('🟢 Gültig:      ' + valid);
    console.log('🟡 Vorschlag:   ' + suggestion);
    console.log('🔴 Ungültig:    ' + invalid);
    console.log('⚪ Fehler:      ' + error);
    console.log('========================================');

  } catch (err) {
    console.error('\n❌ Fataler Fehler:', err.message);
    process.exit(1);
  }
}

main();
