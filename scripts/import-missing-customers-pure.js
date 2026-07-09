/**
 * Initial-Import: Alle fehlenden Easybill-Kunden in die TMS-Datenbank importieren.
 * PURE NODE.JS — Keine externen Module nötig.
 * 
 * Usage: node scripts/import-missing-customers-pure.js
 */

const fs = require('fs');

// ============================================================
// .env Datei parsen
// ============================================================

function loadEnv(path) {
  const content = fs.readFileSync(path, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).trim();
    }
  }
  return env;
}

const env = loadEnv('.env.production');
const EASYBILL_API_KEY = env.EASYBILL_API_KEY;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!EASYBILL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Fehler: EASYBILL_API_KEY, NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.production');
  process.exit(1);
}

const PAGE_SIZE = 100;

// ============================================================
// Supabase HTTP Client (einfach, keine externen Module)
// ============================================================

async function supabaseRequest(table, method = 'GET', body = null, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  
  // Query params
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }
  
  const headers = {
    'apikey': SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'count=exact',
  };
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(url.toString(), options);
  const text = await response.text();
  
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${table} failed: ${response.status} - ${text}`);
  }
  
  return data;
}

// ============================================================
// Easybill API: Alle Kunden laden
// ============================================================

async function fetchAllEasybillCustomers() {
  const customers = [];
  let page = 1;
  
  while (true) {
    console.log(`[Easybill] Lade Seite ${page}...`);
    
    const response = await fetch(
      `https://api.easybill.de/rest/v1/customers?limit=${PAGE_SIZE}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${EASYBILL_API_KEY}`,
          Accept: 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Easybill API Fehler: ${response.status}`);
    }
    
    const data = await response.json();
    const items = data.items || [];
    
    if (items.length === 0) break;
    
    customers.push(...items);
    console.log(`[Easybill] Seite ${page}: ${items.length} Kunden geladen (Gesamt: ${customers.length})`);
    
    if (items.length < PAGE_SIZE) break;
    page++;
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return customers;
}

// ============================================================
// Bestehende Partner laden
// ============================================================

async function getExistingPartnerNumbers() {
  const numbers = new Set();
  let offset = 0;
  const limit = 1000;
  
  while (true) {
    const data = await supabaseRequest(
      'partners',
      'GET',
      null,
      {
        select: 'easybill_customer_number',
        'easybill_customer_number': 'not.is.null',
        offset: offset,
        limit: limit,
      }
    );
    
    if (!Array.isArray(data) || data.length === 0) break;
    
    for (const partner of data) {
      if (partner.easybill_customer_number) {
        numbers.add(String(partner.easybill_customer_number));
      }
    }
    
    offset += limit;
    
    if (data.length < limit) break;
  }
  
  return numbers;
}

// ============================================================
// Partner erstellen
// ============================================================

function buildDisplayName(customer) {
  return customer.company_name?.trim()
    || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()
    || 'Unbekannt';
}

function getPrimaryEmail(customer) {
  if (customer.emails && customer.emails.length > 0) {
    return customer.emails[0].email;
  }
  if (customer.address && customer.address.email) {
    return customer.address.email;
  }
  return null;
}

async function createPartner(customer) {
  const displayName = buildDisplayName(customer);
  const primaryEmail = getPrimaryEmail(customer);
  
  const isActive = !customer.archived;
  
  const body = {
    easybill_id: customer.id,
    easybill_customer_number: customer.number,
    partner_type: 'customer',
    entity_type: customer.company_name ? 'company' : 'person',
    company_name: customer.company_name,
    first_name: customer.first_name,
    last_name: customer.last_name,
    display_name: displayName,
    email: primaryEmail,
    phone: customer.phone,
    mobile: customer.mobile,
    vat_identifier: customer.vat_identifier,
    tax_number: customer.tax_number,
    easybill_group_id: customer.group_id,
    is_active: isActive,
    is_archived: false,
    source_system: 'easybill',
    raw_easybill_payload: customer,
    easybill_created_at: customer.created_at,
    easybill_updated_at: customer.updated_at,
  };
  
  const result = await supabaseRequest('partners', 'POST', body);
  return result;
}

// ============================================================
// Adressen erstellen
// ============================================================

async function createAddresses(partnerId, customer) {
  const errors = [];
  
  if (customer.address) {
    const billingAddress = {
      partner_id: partnerId,
      address_type: 'billing',
      is_primary: true,
      is_active: true,
      company_name: customer.address.company_name,
      first_name: customer.address.first_name,
      last_name: customer.address.last_name,
      street: `${customer.address.street || ''} ${customer.address.number || ''}`.trim(),
      postal_code: customer.address.zip_code,
      city: customer.address.city,
      country: customer.address.country,
      raw_easybill_payload: customer.address,
    };
    
    try {
      await supabaseRequest('partner_addresses', 'POST', billingAddress);
    } catch (error) {
      errors.push(`Rechnungsadresse fehlgeschlagen: ${error.message}`);
    }
  }
  
  const deliveryAddr = customer.delivery_address || customer.address;
  if (deliveryAddr) {
    const shippingAddress = {
      partner_id: partnerId,
      address_type: 'shipping',
      is_primary: false,
      is_active: true,
      company_name: deliveryAddr.company_name,
      first_name: deliveryAddr.first_name,
      last_name: deliveryAddr.last_name,
      street: `${deliveryAddr.street || ''} ${deliveryAddr.number || ''}`.trim(),
      postal_code: deliveryAddr.zip_code,
      city: deliveryAddr.city,
      country: deliveryAddr.country,
      raw_easybill_payload: deliveryAddr,
    };
    
    try {
      await supabaseRequest('partner_addresses', 'POST', shippingAddress);
    } catch (error) {
      errors.push(`Lieferadresse fehlgeschlagen: ${error.message}`);
    }
  }
  
  return errors;
}

// ============================================================
// Kontakt erstellen
// ============================================================

async function createContact(partnerId, customer) {
  const primaryEmail = getPrimaryEmail(customer);
  
  if (!primaryEmail) {
    return ['Keine E-Mail-Adresse für Kontakt vorhanden'];
  }
  
  const contact = {
    partner_id: partnerId,
    first_name: customer.first_name,
    last_name: customer.last_name,
    display_name: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Unbekannt',
    email: primaryEmail,
    phone: customer.phone,
    mobile: customer.mobile,
    is_primary: true,
    is_invoice_recipient: true,
    is_active: true,
  };
  
  try {
    await supabaseRequest('partner_contacts', 'POST', contact);
    return [];
  } catch (error) {
    return [`Kontakt fehlgeschlagen: ${error.message}`];
  }
}

// ============================================================
// Haupt-Import
// ============================================================

async function importMissingCustomers() {
  console.log('=== Initial-Import fehlender Easybill-Kunden ===\n');
  
  try {
    console.log('1. Lade alle Easybill-Kunden...');
    const easybillCustomers = await fetchAllEasybillCustomers();
    console.log(`   ${easybillCustomers.length} Kunden in Easybill\n`);
    
    console.log('2. Lade bestehende Partner aus DB...');
    const existingNumbers = await getExistingPartnerNumbers();
    console.log(`   ${existingNumbers.size} Partner bereits in DB\n`);
    
    console.log('3. Identifiziere fehlende Kunden...');
    const missing = easybillCustomers.filter(
      c => !existingNumbers.has(String(c.number))
    );
    console.log(`   ${missing.length} fehlende Kunden gefunden\n`);
    
    if (missing.length === 0) {
      console.log('✅ Alle Kunden sind bereits importiert!');
      return;
    }
    
    console.log('4. Importiere fehlende Kunden...\n');
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < missing.length; i++) {
      const customer = missing[i];
      const progress = `${i + 1}/${missing.length}`;
      
      console.log(`   [${progress}] ${customer.number} | ${customer.company_name || (customer.first_name + ' ' + customer.last_name)}`);
      
      try {
        // 1. Partner erstellen
        const partner = await createPartner(customer);
        const partnerId = partner.id;
        
        // 2. Adressen
        const addressErrors = await createAddresses(partnerId, customer);
        
        // 3. Kontakt
        const contactErrors = await createContact(partnerId, customer);
        
        imported++;
        console.log(`      ✅ Importiert (Partner ID: ${partnerId})`);
        
        if (addressErrors.length > 0) {
          console.log(`         ⚠️ Adress-Warnungen: ${addressErrors.join('; ')}`);
        }
        if (contactErrors.length > 0) {
          console.log(`         ⚠️ Kontakt-Warnungen: ${contactErrors.join('; ')}`);
        }
        
      } catch (error) {
        failed++;
        console.log(`      ❌ Fehler: ${error.message}`);
      }
      
      // Rate Limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Statistik
    console.log('\n=== Import-Statistik ===');
    console.log(`Gesamt Easybill-Kunden:     ${easybillCustomers.length}`);
    console.log(`Bereits in DB:              ${existingNumbers.size}`);
    console.log(`Fehlende Kunden:            ${missing.length}`);
    console.log(`Erfolgreich importiert:     ${imported}`);
    console.log(`Fehlgeschlagen:             ${failed}`);
    console.log(`Erfolgsrate:                ${((imported / missing.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('\n❌ Fataler Fehler:', error.message);
    process.exit(1);
  }
}

// Starten
importMissingCustomers();
