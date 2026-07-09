/**
 * Initial-Import: Alle fehlenden Easybill-Kunden in die TMS-Datenbank importieren.
 * 
 * Usage: npx ts-node scripts/import-missing-customers.ts
 * 
 * Dieses Script:
 * 1. Lädt alle Easybill-Kunden (paginiert)
 * 2. Vergleicht mit bestehenden Partnern (easybill_customer_number)
 * 3. Importiert fehlende Kunden über syncEasybillCustomer()
 * 4. Zeigt Statistiken an
 */

import { syncEasybillCustomer } from "../src/lib/easybill/partner-sync";
import { createAdminClient } from "../src/lib/supabase/admin";

const EASYBILL_API_KEY = proces…KEY;
const PAGE_SIZE = 100;

async function fetchAllEasybillCustomers(): Promise<any[]> {
  const customers: any[] = [];
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

async function getExistingPartnerNumbers(): Promise<Set<string>> {
  const supabase = createAdminClient();
  const numbers = new Set<string>();
  
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
      } catch (error: any) {
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
    
  } catch (error: any) {
    console.error('\n❌ Fataler Fehler:', error.message);
    process.exit(1);
  }
}

// Starten
importMissingCustomers();
