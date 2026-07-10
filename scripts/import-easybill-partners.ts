/**
 * PROJ-24: Initial-Import der fehlenden Easybill-Kunden
 * 
 * Lädt alle aktiven Kunden von Easybill und importiert diejenigen,
 * die noch nicht in unserer Datenbank (tms.partners) existieren.
 */

const fs = require('fs');

// Config aus .env.production
const envPath = '/home/botti/.openclaw/workspace/.env.production';
const envContent = fs.readFileSync(envPath, 'utf8');
const getEnv = (key: string) => {
  const match = envContent.match(new RegExp(`${key}=([^\\n]+)`));
  return match ? match[1].trim() : '';
};

const EASYBILL_API_KEY = ***'EASYBILL_API_KEY');
const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_KEY = ***'SUPABASE_SERVICE_ROLE_KEY');

if (!EASYBILL_API_KEY || !SUPABASE_KEY) {
  console.error('❌ EASYBILL_API_KEY oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.production');
  process.exit(1);
}

// ============================================================
// Easybill API
// ============================================================

async function easybillFetch(endpoint: string, options: any = {}) {
  const url = `https://api.easybill.de/rest/v1${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${EASYBILL_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Easybill API Error ${res.status}: ${text}`);
  }
  
  return res.json();
}

async function getAllEasybillCustomers() {
  const all: any[] = [];
  let page = 1;
  const limit = 1000;
  
  while (true) {
    console.log(`📥 Lade Easybill Kunden (Page ${page})...`);
    const data = await easybillFetch(`/customers?page=${page}&limit=${limit}`);
    
    if (!data.items || data.items.length === 0) break;
    
    all.push(...data.items);
    console.log(`   ✅ ${data.items.length} Kunden geladen (Total: ${all.length})`);
    
    if (data.items.length < limit) break;
    page++;
  }
  
  return all;
}

// ============================================================
// Supabase (Admin)
// ============================================================

async function supabaseQuery(table: string, query: string = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed: ${res.status} ${text}`);
  }
  
  return res.json();
}

async function supabaseInsert(table: string, data: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase insert failed: ${res.status} ${text}`);
  }
  
  return res.json();
}

// ============================================================
// Prüfung: Existiert Kunde schon?
// ============================================================

async function checkExistingCustomer(customer: any) {
  // 1. Prüfe easybill_id (PRIMARY KEY)
  const byId = await supabaseQuery('partners', `easybill_id=eq.${customer.id}&select=id,easybill_customer_number`);
  if (byId && byId.length > 0) {
    return { exists: true, reason: 'easybill_id_exists', partnerId: byId[0].id };
  }
  
  // 2. Prüfe easybill_customer_number (nur wenn nicht leer)
  if (customer.number && customer.number.trim()) {
    const byNumber = await supabaseQuery('partners', `easybill_customer_number=eq.${encodeURIComponent(customer.number)}&select=id`);
    if (byNumber && byNumber.length > 0) {
      return { exists: true, reason: 'customer_number_exists', partnerId: byNumber[0].id };
    }
  }
  
  return { exists: false };
}

// ============================================================
// Sync-Logik
// ============================================================

function normalizeDisplayName(customer: any): string {
  if (customer.company_name?.trim()) return customer.company_name.trim();
  const name = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  return name || 'Unbekannt';
}

async function syncCustomer(customer: any) {
  const actions: string[] = [];
  const errors: string[] = [];
  
  try {
    // Prüfen ob Kunde schon existiert
    const existing = await checkExistingCustomer(customer);
    if (existing.exists) {
      return { success: true, skipped: true, reason: existing.reason, actions, errors };
    }
    
    // 1. Partner anlegen
    const displayName = normalizeDisplayName(customer);
    const isActive = !customer.archived;
    const primaryEmail = customer.emails?.[0]?.email || customer.address?.email || null;
    
    const partnerData = {
      easybill_id: customer.id,
      easybill_customer_number: customer.number || null,
      partner_type: 'customer',
      entity_type: customer.company_name ? 'company' : 'person',
      company_name: customer.company_name || null,
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
      display_name: displayName,
      email: primaryEmail,
      phone: customer.phone || null,
      mobile: customer.mobile || null,
      vat_identifier: customer.vat_identifier || null,
      tax_number: customer.tax_number || null,
      easybill_group_id: customer.group_id || null,
      is_active: isActive,
      is_archived: false,
      source_system: 'easybill',
      raw_easybill_payload: customer,
      easybill_created_at: customer.created_at,
      easybill_updated_at: customer.updated_at,
    };
    
    const partner = await supabaseInsert('partners', partnerData);
    const partnerId = partner[0].id;
    actions.push('partner_created');
    
    // 2. Adressen anlegen
    if (customer.address) {
      const billingAddress = {
        partner_id: partnerId,
        address_type: 'billing',
        is_primary: true,
        is_active: true,
        company_name: customer.address.company_name || null,
        first_name: customer.address.first_name || null,
        last_name: customer.address.last_name || null,
        street: `${customer.address.street || ''} ${customer.address.number || ''}`.trim(),
        postal_code: customer.address.zip_code || null,
        city: customer.address.city || null,
        country: customer.address.country || null,
        raw_easybill_payload: customer.address,
      };
      
      await supabaseInsert('partner_addresses', billingAddress);
      actions.push('billing_address_created');
    }
    
    // Lieferadresse (falls vorhanden, sonst Rechnungsadresse kopieren)
    const deliveryAddr = customer.delivery_address || customer.address;
    if (deliveryAddr) {
      const shippingAddress = {
        partner_id: partnerId,
        address_type: 'shipping',
        is_primary: false,
        is_active: true,
        company_name: deliveryAddr.company_name || null,
        first_name: deliveryAddr.first_name || null,
        last_name: deliveryAddr.last_name || null,
        street: `${deliveryAddr.street || ''} ${deliveryAddr.number || ''}`.trim(),
        postal_code: deliveryAddr.zip_code || null,
        city: deliveryAddr.city || null,
        country: deliveryAddr.country || null,
        raw_easybill_payload: deliveryAddr,
      };
      
      await supabaseInsert('partner_addresses', shippingAddress);
      actions.push('shipping_address_created');
    }
    
    // 3. Kontakt anlegen
    if (primaryEmail) {
      const contact = {
        partner_id: partnerId,
        first_name: customer.first_name || null,
        last_name: customer.last_name || null,
        display_name: displayName,
        email: primaryEmail,
        phone: customer.phone || null,
        mobile: customer.mobile || null,
        is_primary: true,
        is_invoice_recipient: true,
        is_active: true,
      };
      
      await supabaseInsert('partner_contacts', contact);
      actions.push('contact_created');
    } else {
      errors.push('Keine E-Mail-Adresse vorhanden');
    }
    
    // 4. Sync-Log eintragen
    await supabaseInsert('easybill_sync_logs', {
      easybill_id: customer.id,
      easybill_customer_number: customer.number || null,
      partner_id: partnerId,
      action: errors.length > 0 ? 'import_with_warnings' : 'import',
      target_table: 'partners',
      message: `Importiert: ${displayName}`,
      raw_payload: { errors: errors.length > 0 ? errors : null },
    });
    
    return { success: true, partnerId, actions, errors };
    
  } catch (error: any) {
    errors.push(`Fatal error: ${error.message}`);
    
    // Fehler loggen
    await supabaseInsert('easybill_sync_logs', {
      easybill_id: customer.id,
      easybill_customer_number: customer.number || null,
      partner_id: null,
      action: 'failed',
      target_table: 'partners',
      message: `Fehler bei ${customer.number}: ${error.message}`,
      raw_payload: { error: error.message },
    });
    
    return { success: false, actions, errors };
  }
}

// ============================================================
// Hauptfunktion
// ============================================================

async function main() {
  console.log('🚀 PROJ-24: Initial-Import der fehlenden Easybill-Kunden\n');
  const startTime = Date.now();
  
  try {
    // 1. Alle Easybill-Kunden laden
    console.log('📥 Schritt 1: Easybill-Kunden laden...');
    const easybillCustomers = await getAllEasybillCustomers();
    console.log(`✅ ${easybillCustomers.length} Kunden von Easybill geladen\n`);
    
    // 2. Prüfen welche Kundennummern schon bei uns existieren
    console.log('🔍 Schritt 2: Prüfe existierende Kunden...');
    const existingIds = new Set();
    const existingNumbers = new Set();
    let dbOffset = 0;
    const dbLimit = 1000;
    
    while (true) {
      const existing = await supabaseQuery(
        'partners',
        `select=easybill_id,easybill_customer_number&limit=${dbLimit}&offset=${dbOffset}`
      );
      
      if (!existing || existing.length === 0) break;
      
      existing.forEach((p: any) => {
        if (p.easybill_id) existingIds.add(String(p.easybill_id));
        if (p.easybill_customer_number) existingNumbers.add(p.easybill_customer_number);
      });
      
      if (existing.length < dbLimit) break;
      dbOffset += dbLimit;
    }
    
    console.log(`✅ ${existingIds.size} easybill_ids in DB`);
    console.log(`✅ ${existingNumbers.size} customer_numbers in DB\n`);
    
    // 3. Fehlende Kunden filtern
    const missingCustomers = easybillCustomers.filter((c: any) => {
      // Prüfe easybill_id
      if (existingIds.has(String(c.id))) return false;
      // Prüfe customer_number (nur wenn nicht leer)
      if (c.number && c.number.trim() && existingNumbers.has(c.number)) return false;
      return true;
    });
    
    console.log(`📊 Ergebnis:`);
    console.log(`   Easybill Total: ${easybillCustomers.length}`);
    console.log(`   Bereits in DB:  ${easybillCustomers.length - missingCustomers.length}`);
    console.log(`   Fehlend:        ${missingCustomers.length}\n`);
    
    if (missingCustomers.length === 0) {
      console.log('✅ Alle Kunden sind bereits importiert!');
      return;
    }
    
    // 4. Fehlende Kunden importieren
    console.log('📥 Schritt 3: Importiere fehlende Kunden...\n');
    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < missingCustomers.length; i++) {
      const customer = missingCustomers[i];
      const displayName = normalizeDisplayName(customer);
      
      console.log(`   [${i + 1}/${missingCustomers.length}] ${displayName} (ID: ${customer.id})`);
      
      const result = await syncCustomer(customer);
      
      if (result.skipped) {
        skippedCount++;
        console.log(`      ⏭️  Übersprungen: ${result.reason}`);
      } else if (result.success && result.errors.length === 0) {
        successCount++;
        console.log(`      ✅ Erfolgreich importiert`);
      } else if (result.success && result.errors.length > 0) {
        warningCount++;
        console.log(`      ⚠️  Importiert mit Warnungen: ${result.errors.join(', ')}`);
      } else {
        errorCount++;
        console.log(`      ❌ Fehler: ${result.errors.join(', ')}`);
      }
      
      // Kleine Pause um Rate-Limits zu vermeiden
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 5. Ergebnis
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('📋 IMPORT-ERGEBNIS');
    console.log(`Dauer:              ${duration}s`);
    console.log(`Erfolgreich:        ${successCount}`);
    console.log(`Mit Warnungen:      ${warningCount}`);
    console.log(`Übersprungen:       ${skippedCount}`);
    console.log(`Fehler:             ${errorCount}`);
    console.log(`Gesamt:             ${missingCustomers.length}`);
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ Fataler Fehler:', error.message);
    process.exit(1);
  }
}

// Starten
main();
