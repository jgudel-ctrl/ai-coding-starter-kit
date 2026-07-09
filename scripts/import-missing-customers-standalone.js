/**
 * Initial-Import: Alle fehlenden Easybill-Kunden in die TMS-Datenbank importieren.
 * STANDALONE VERSION — verwendet direkte Supabase-Client Erstellung.
 * 
 * Usage: node scripts/import-missing-customers-standalone.js
 * 
 * Dieses Script:
 * 1. Lädt alle Easybill-Kunden (paginiert)
 * 2. Vergleicht mit bestehenden Partnern (easybill_customer_number)
 * 3. Importiert fehlende Kunden (einfache Version ohne Dubletten-Check)
 * 4. Zeigt Statistiken an
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const EASYBILL_API_KEY = process.env.EASYBILL_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE_SIZE = 100;

// Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'tms' },
});

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
    
    // Rate Limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return customers;
}

// ============================================================
// Bestehende Partner laden
// ============================================================

async function getExistingPartnerNumbers() {
  const numbers = new Set();
  
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('partners')
      .select('easybill_customer_number')
      .not('easybill_customer_number', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('Fehler beim Laden bestehender Partner:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    for (const partner of data) {
      if (partner.easybill_customer_number) {
        numbers.add(String(partner.easybill_customer_number));
      }
    }
    
    page++;
  }
  
  return numbers;
}

// ============================================================
// Partner erstellen (vereinfacht)
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
  
  // Regel Ü2: Archivierte Kunden → is_active = false
  const isActive = !customer.archived;
  
  const { data: partner, error } = await supabase
    .from('partners')
    .insert({
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
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Partner konnte nicht angelegt werden: ${error.message}`);
  }
  
  return partner;
}

// ============================================================
// Adressen erstellen
// ============================================================

async function createAddresses(partnerId, customer) {
  const errors = [];
  
  // Rechnungsadresse
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
    
    const { error } = await supabase.from('partner_addresses').insert(billingAddress);
    if (error) errors.push(`Rechnungsadresse fehlgeschlagen: ${error.message}`);
  }
  
  // Lieferadresse (Regel Ü4: falls nicht vorhanden, Rechnungsadresse kopieren)
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
    
    const { error } = await supabase.from('partner_addresses').insert(shippingAddress);
    if (error) errors.push(`Lieferadresse fehlgeschlagen: ${error.message}`);
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
  
  const { error } = await supabase.from('partner_contacts').insert(contact);
  if (error) return [`Kontakt fehlgeschlagen: ${error.message}`];
  
  return [];
}

// ============================================================
// Rabatte sync (Voll-Replace)
// ============================================================

async function syncDiscounts(partnerId, easybillCustomerId) {
  const errors = [];
  
  try {
    // Produktgruppen aktualisieren
    const pgResponse = await fetch(
      'https://api.easybill.de/rest/v1/position-groups',
      {
        headers: {
          Authorization: `Bearer ${EASYBILL_API_KEY}`,
        },
      }
    );
    
    let pgData = null;
    if (pgResponse.ok) {
      pgData = await pgResponse.json();
      for (const group of pgData.items || []) {
        await supabase.from('position_groups').upsert({
          id: group.id,
          name: group.name,
          display_name: group.display_name,
          number: group.number,
          description: group.description,
          raw_easybill_payload: group,
          updated_at: new Date().toISOString(),
        });
      }
    }
    
    // Alte Rabatte löschen
    await supabase.from('partner_discounts').delete().eq('partner_id', partnerId);
    
    // Neue Rabatte importieren
    const discountResponse = await fetch(
      `https://api.easybill.de/rest/v1/discounts/position-group?customer_id=${easybillCustomerId}`,
      {
        headers: {
          Authorization: `Bearer ${EASYBILL_API_KEY}`,
        },
      }
    );
    
    if (discountResponse.ok) {
      const discountData = await discountResponse.json();
      const discounts = discountData.items || [];
      
      for (const discount of discounts) {
        const group = pgData?.items?.find(g => g.id === discount.position_group_id);
        
        await supabase.from('partner_discounts').insert({
          partner_id: partnerId,
          easybill_discount_id: discount.id,
          position_group_id: discount.position_group_id,
          position_group_name: group?.name,
          position_group_number: group?.number,
          discount_percent: discount.discount,
          discount_type: discount.discount_type,
          raw_easybill_payload: discount,
        });
      }
    }
    
  } catch (error) {
    errors.push(`Rabatt-Sync fehlgeschlagen: ${error.message}`);
  }
  
  return errors;
}

// ============================================================
// Haupt-Funktion: Sync Easybill Customer
// ============================================================

async function syncEasybillCustomer(customer) {
  const actions = [];
  const errors = [];
  
  try {
    // 1. Partner erstellen
    const partner = await createPartner(customer);
    actions.push('created');
    
    // 2. Adressen erstellen
    const addressErrors = await createAddresses(partner.id, customer);
    if (addressErrors.length === 0) actions.push('addresses_inserted');
    else errors.push(...addressErrors);
    
    // 3. Kontakt erstellen
    const contactErrors = await createContact(partner.id, customer);
    if (contactErrors.length === 0) actions.push('contact_inserted');
    else errors.push(...contactErrors);
    
    // 4. Rabatte sync
    const discountErrors = await syncDiscounts(partner.id, customer.id);
    if (discountErrors.length === 0) actions.push('discounts_synced');
    else errors.push(...discountErrors);
    
    return { success: true, partnerId: partner.id, actions, errors };
    
  } catch (error) {
    return { success: false, actions, errors: [...errors, `Fatal error: ${error.message}`] };
  }
}

// ============================================================
// Haupt-Import
// ============================================================

async function importMissingCustomers() {
  console.log('=== Initial-Import fehlender Easybill-Kunden ===\n');
  
  try {
    // 1. Alle Easybill-Kunden laden
    console.log('1. Lade alle Easybill-Kunden...');
    const easybillCustomers = await fetchAllEasybillCustomers();
    console.log(`   ${easybillCustomers.length} Kunden in Easybill\n`);
    
    // 2. Bestehende Partner laden
    console.log('2. Lade bestehende Partner aus DB...');
    const existingNumbers = await getExistingPartnerNumbers();
    console.log(`   ${existingNumbers.size} Partner bereits in DB\n`);
    
    // 3. Fehlende Kunden identifizieren
    console.log('3. Identifiziere fehlende Kunden...');
    const missing = easybillCustomers.filter(
      c => !existingNumbers.has(String(c.number))
    );
    console.log(`   ${missing.length} fehlende Kunden gefunden\n`);
    
    if (missing.length === 0) {
      console.log('✅ Alle Kunden sind bereits importiert!');
      return;
    }
    
    // 4. Fehlende Kunden importieren
    console.log('4. Importiere fehlende Kunden...\n');
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < missing.length; i++) {
      const customer = missing[i];
      const progress = `${i + 1}/${missing.length}`;
      
      console.log(`   [${progress}] ${customer.number} | ${customer.company_name || customer.first_name + ' ' + customer.last_name}`);
      
      try {
        const result = await syncEasybillCustomer(customer);
        
        if (result.success) {
          imported++;
          console.log(`      ✅ Importiert (Partner ID: ${result.partnerId})`);
        } else {
          failed++;
          console.log(`      ❌ Fehler: ${result.errors.join('; ')}`);
        }
      } catch (error) {
        failed++;
        console.log(`      ❌ Fataler Fehler: ${error.message}`);
      }
      
      // Rate Limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 5. Statistik
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
