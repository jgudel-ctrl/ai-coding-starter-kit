/**
 * PROJ-24: Stündlicher Fallback-Cronjob für Easybill Sync
 */

const fs = require('fs');

const envPath = '/home/botti/.openclaw/workspace/.env.production';
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const regex = new RegExp('^' + key + '=(.+)$', 'm');
  const match = envContent.match(regex);
  return match ? match[1].trim() : '';
}

const EASYBILL_API_KEY = getEnv('EASYBILL_API_KEY');
const SUPABASE_URL = 'https://supabase.gudel-werkzeuge.de';
const SUPABASE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!EASYBILL_API_KEY || !SUPABASE_KEY) {
  console.error('❌ EASYBILL_API_KEY oder SUPABASE_SERVICE_ROLE_KEY fehlt in .env.production');
  process.exit(1);
}

async function easybillFetch(endpoint, options = {}) {
  const url = 'https://api.easybill.de/rest/v1' + endpoint;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + EASYBILL_API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Easybill API Error ' + res.status + ': ' + text);
  }
  
  return res.json();
}

async function supabaseQuery(table, query = '') {
  const url = SUPABASE_URL + '/rest/v1/' + table + '?' + query;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase query failed: ' + res.status + ' ' + text);
  }
  
  return res.json();
}

async function supabaseInsert(table, data) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Supabase insert failed: ' + res.status + ' ' + text);
  }
  
  return res.json();
}

function normalizeDisplayName(customer) {
  if (customer.company_name && customer.company_name.trim()) return customer.company_name.trim();
  const name = (customer.first_name || '') + ' ' + (customer.last_name || '');
  return name.trim() || 'Unbekannt';
}

async function checkExistingCustomer(customer) {
  const byId = await supabaseQuery('partners', 'easybill_id=eq.' + customer.id + '&select=id,easybill_customer_number');
  if (byId && byId.length > 0) {
    return { exists: true, reason: 'easybill_id_exists', partnerId: byId[0].id };
  }
  
  if (customer.number && customer.number.trim()) {
    const byNumber = await supabaseQuery('partners', 'easybill_customer_number=eq.' + encodeURIComponent(customer.number) + '&select=id');
    if (byNumber && byNumber.length > 0) {
      return { exists: true, reason: 'customer_number_exists', partnerId: byNumber[0].id };
    }
  }
  
  return { exists: false };
}

async function syncCustomer(customer) {
  const actions = [];
  const errors = [];
  
  try {
    const existing = await checkExistingCustomer(customer);
    if (existing.exists) {
      const displayName = normalizeDisplayName(customer);
      const primaryEmail = customer.emails && customer.emails[0] ? customer.emails[0].email : (customer.address ? customer.address.email : null);
      
      await supabaseInsert('easybill_sync_logs', {
        easybill_id: customer.id,
        easybill_customer_number: customer.number || null,
        partner_id: existing.partnerId,
        action: 'update',
        target_table: 'partners',
        message: 'Aktualisiert: ' + displayName,
        raw_payload: { display_name: displayName, email: primaryEmail },
      });
      
      return { success: true, partnerId: existing.partnerId, actions, errors };
    }
    
    const displayName = normalizeDisplayName(customer);
    const isActive = !customer.archived;
    const primaryEmail = customer.emails && customer.emails[0] ? customer.emails[0].email : (customer.address ? customer.address.email : null);
    
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
    
    if (customer.address) {
      const billingAddress = {
        partner_id: partnerId,
        address_type: 'billing',
        is_primary: true,
        is_active: true,
        company_name: customer.address.company_name || null,
        first_name: customer.address.first_name || null,
        last_name: customer.address.last_name || null,
        street: (customer.address.street || '') + ' ' + (customer.address.number || ''),
        postal_code: customer.address.zip_code || null,
        city: customer.address.city || null,
        country: customer.address.country || null,
        raw_easybill_payload: customer.address,
      };
      
      await supabaseInsert('partner_addresses', billingAddress);
      actions.push('billing_address_created');
    }
    
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
        street: (deliveryAddr.street || '') + ' ' + (deliveryAddr.number || ''),
        postal_code: deliveryAddr.zip_code || null,
        city: deliveryAddr.city || null,
        country: deliveryAddr.country || null,
        raw_easybill_payload: deliveryAddr,
      };
      
      await supabaseInsert('partner_addresses', shippingAddress);
      actions.push('shipping_address_created');
    }
    
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
    
    await supabaseInsert('easybill_sync_logs', {
      easybill_id: customer.id,
      easybill_customer_number: customer.number || null,
      partner_id: partnerId,
      action: errors.length > 0 ? 'import_with_warnings' : 'import',
      target_table: 'partners',
      message: 'Importiert: ' + displayName,
      raw_payload: { errors: errors.length > 0 ? errors : null },
    });
    
    return { success: true, partnerId, actions, errors };
    
  } catch (error) {
    errors.push('Fatal error: ' + error.message);
    
    await supabaseInsert('easybill_sync_logs', {
      easybill_id: customer.id,
      easybill_customer_number: customer.number || null,
      partner_id: null,
      action: 'failed',
      target_table: 'partners',
      message: 'Fehler bei ' + customer.number + ': ' + error.message,
      raw_payload: { error: error.message },
    });
    
    return { success: false, actions, errors };
  }
}

async function main() {
  console.log('🕐 PROJ-24: Stündlicher Easybill Sync\n');
  const startTime = Date.now();
  
  try {
    console.log('📥 Letzte Sync-Zeit holen...');
    const lastSyncResult = await supabaseQuery(
      'easybill_sync_logs',
      'select=created_at&order=created_at.desc&limit=1'
    );
    
    const lastSync = lastSyncResult && lastSyncResult[0] ? lastSyncResult[0].created_at : null;
    console.log('   Letzter Sync: ' + (lastSync || 'Nie') + '\n');
    
    console.log('📥 Lade geänderte Kunden von Easybill...');
    
    let url = '/customers?limit=1000';
    if (lastSync) {
      const sinceDate = new Date(lastSync).toISOString().split('T')[0];
      url += '&updated_at[gte]=' + encodeURIComponent(sinceDate);
    }
    
    const data = await easybillFetch(url);
    const customers = data.items || [];
    
    console.log('   ✅ ' + customers.length + ' Kunden zu verarbeiten\n');
    
    if (customers.length === 0) {
      console.log('✅ Keine neuen/geänderten Kunden');
      return;
    }
    
    console.log('📥 Verarbeite Kunden...\n');
    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const displayName = normalizeDisplayName(customer);
      
      console.log('   [' + (i + 1) + '/' + customers.length + '] ' + displayName + ' (ID: ' + customer.id + ')');
      
      const result = await syncCustomer(customer);
      
      if (result.success && result.errors.length === 0) {
        successCount++;
        console.log('      ✅ OK');
      } else if (result.success && result.errors.length > 0) {
        warningCount++;
        console.log('      ⚠️  ' + result.errors.join(', '));
      } else {
        errorCount++;
        console.log('      ❌ ' + result.errors.join(', '));
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('📋 SYNC-ERGEBNIS');
    console.log('Dauer:              ' + duration + 's');
    console.log('Erfolgreich:        ' + successCount);
    console.log('Mit Warnungen:      ' + warningCount);
    console.log('Fehler:             ' + errorCount);
    console.log('Gesamt:             ' + customers.length);
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ Fataler Fehler:', error.message);
    process.exit(1);
  }
}

main();
