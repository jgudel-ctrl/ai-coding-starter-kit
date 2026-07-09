/**
 * Easybill Partner Sync Cronjob
 * 
 * Stündlicher Fallback-Cronjob.
 * Holt alle Kunden von Easybill, die seit dem letzten Sync geändert wurden.
 * 
 * Schedule: Jede Stunde (0 * * * *)
 * 
 * Wichtig:
 * - Verwendet Service-Role (keine Auth erforderlich)
 * - Nur Kunden seit letztem Lauf
 * - Logging in easybill_sync_logs
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { syncEasybillCustomer } from "@/lib/easybill/partner-sync";

// ============================================================
// Haupt-Funktion: Cronjob Handler
// ============================================================

export async function runPartnerSyncCron() {
  const supabase = createAdminClient();
  const errors: string[] = [];
  const actions: string[] = [];

  console.log('[Cron] Starting Easybill Partner Sync...');

  try {
    // 1. Letzten Sync-Zeitpunkt ermitteln
    const lastSyncTime = await getLastSyncTime(supabase);
    console.log(`[Cron] Last sync: ${lastSyncTime || 'never'}`);

    // 2. Easybill API abfragen
    const easybillCustomers = await fetchEasybillCustomersSince(lastSyncTime);
    console.log(`[Cron] Found ${easybillCustomers.length} changed customers`);

    if (easybillCustomers.length === 0) {
      console.log('[Cron] No changes - nothing to do');
      await logCronResult(supabase, { actions: ['no_changes'], errors: [] });
      return { success: true, processed: 0, actions, errors };
    }

    // 3. Jeden Kunden synchronisieren
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const customer of easybillCustomers) {
      try {
        const result = await syncEasybillCustomer(customer);
        processed++;

        if (result.success) {
          if (result.actions.includes('created')) created++;
          if (result.actions.includes('updated')) updated++;
          actions.push(...result.actions);
        } else {
          failed++;
          errors.push(...result.errors);
        }

        // Logging
        await logSyncResult(supabase, {
          easybillId: customer.id,
          customerNumber: customer.number,
          status: result.success ? 'success' : 'error',
          actions: result.actions,
          errors: result.errors,
        });

      } catch (error: any) {
        failed++;
        errors.push(`Failed to sync customer ${customer.number}: ${error.message}`);
        console.error(`[Cron] Failed to sync customer ${customer.number}:`, error);
      }

      // Rate Limiting: Max. 1 Request/Sec zu Easybill
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[Cron] Sync complete: ${processed} processed, ${created} created, ${updated} updated, ${failed} failed`);

    // 5. NACH dem Sync: Dubletten-Prüfung auf alle Partner
    console.log('[Cron] Starting duplicate check...');
    const duplicateResult = await runDuplicateCheck(supabase);
    if (duplicateResult.checked > 0) {
      console.log(`[Cron] Duplicate check: ${duplicateResult.checked} checked, ${duplicateResult.duplicates} found`);
      actions.push(`duplicate_check: ${duplicateResult.checked} checked, ${duplicateResult.duplicates} duplicates`);
    }

    // 6. Ergebnis loggen
    await logCronResult(supabase, {
      actions: [`processed ${processed}`, `created ${created}`, `updated ${updated}`, `failed ${failed}`, ...duplicateResult.actions],
      errors,
    });

    return { success: true, processed, created, updated, failed, actions, errors };

  } catch (error: any) {
    console.error('[Cron] Fatal error:', error);
    errors.push(`Fatal error: ${error.message}`);
    await logCronResult(supabase, { actions: ['fatal_error'], errors });
    return { success: false, processed: 0, actions, errors };
  }
}

// ============================================================
// Easybill API: Kunden seit Zeitpunkt holen
// ============================================================

async function fetchEasybillCustomersSince(since: string | null): Promise<any[]> {
  const apiKey = process.env.EASYBILL_API_KEY;
  if (!apiKey) {
    throw new Error('EASYBILL_API_KEY nicht konfiguriert');
  }

  const customers: any[] = [];
  let page = 1;
  const limit = 100;

  // Falls kein since: 24h zurück
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceIso = sinceDate.toISOString();

  while (true) {
    const url = new URL('https://api.easybill.de/rest/v1/customers');
    url.searchParams.append('limit', String(limit));
    url.searchParams.append('page', String(page));
    
    // Easybill Filter: updated_at_min
    // Hinweis: Easybill API unterstützt möglicherweise keinen direkten Zeitfilter
    // Dann holen wir alle und filtern client-seitig

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Easybill API Fehler: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const items = data.items || [];

    if (items.length === 0) break;

    // Client-seitiges Filtern nach updated_at
    const changedItems = items.filter((item: any) => {
      const updatedAt = new Date(item.updated_at || item.created_at);
      return updatedAt >= sinceDate;
    });

    customers.push(...changedItems);

    // Prüfen: Alle Items älter als since? Dann können wir aufhören
    const allOlder = items.every((item: any) => {
      const updatedAt = new Date(item.updated_at || item.created_at);
      return updatedAt < sinceDate;
    });

    if (allOlder) break;

    // Nächste Seite
    page++;
    if (page > data.pages) break;

    // Rate Limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return customers;
}

// ============================================================
// Letzter Sync-Zeitpunkt
// ============================================================

async function getLastSyncTime(supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('easybill_sync_logs')
      .select('synced_at')
      .eq('sync_type', 'customer')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data.synced_at;
  } catch {
    return null;
  }
}

// ============================================================
// Logging
// ============================================================

async function logSyncResult(
  supabase: any,
  result: {
    easybillId: number;
    customerNumber: string;
    status: string;
    actions: string[];
    errors: string[];
  }
) {
  try {
    await supabase.from('easybill_sync_logs').insert({
      sync_type: 'customer',
      easybill_id: result.easybillId,
      status: result.status,
      details: {
        customer_number: result.customerNumber,
        actions: result.actions,
        errors: result.errors,
      },
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
    });
  } catch (logError: any) {
    console.error('[Cron] Logging failed:', logError.message);
  }
}

async function logCronResult(
  supabase: any,
  result: {
    actions: string[];
    errors: string[];
  }
) {
  try {
    await supabase.from('easybill_sync_logs').insert({
      sync_type: 'customer_cron',
      status: result.errors.length > 0 ? 'partial' : 'success',
      details: {
        actions: result.actions,
        errors: result.errors,
      },
      error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
    });
  } catch (logError: any) {
    console.error('[Cron] Result logging failed:', logError.message);
  }
}

// ============================================================
// API Route (für manuelle Trigger)
// ============================================================

import { NextResponse } from "next/server";

export async function GET() {
  // Sicherheit: Nur interne Requests oder mit Secret
  // In Produktion: Secret-Prüfung hinzufügen
  
  try {
    const result = await runPartnerSyncCron();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// Dubletten-Prüfung: NACH dem Import auf ALLE Partner
// ============================================================

import { checkForDuplicates } from "@/lib/easybill/partner-sync";

async function runDuplicateCheck(supabase: any) {
  const actions: string[] = [];
  let duplicates = 0;

  try {
    // Alle aktiven Partner ohne "duplicate_of" holen
    const { data: partners, error } = await supabase
      .from('partners')
      .select('id')
      .eq('is_active', true)
      .is('duplicate_of', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Cron] Duplicate check error:', error.message);
      return { checked: 0, duplicates: 0, actions: ['duplicate_check_failed'] };
    }

    console.log(`[Cron] Checking ${partners?.length || 0} partners for duplicates...`);

    // Jeden Partner prüfen
    for (const partner of partners || []) {
      await checkForDuplicates(supabase, partner.id);
    }

    // Ergebnis zählen
    const { data: duplicateCount, error: countError } = await supabase
      .from('partners')
      .select('id', { count: 'exact', head: true })
      .not('duplicate_of', 'is', null);

    if (!countError && duplicateCount) {
      duplicates = duplicateCount;
    }

    return {
      checked: partners?.length || 0,
      duplicates,
      actions: [`duplicate_check_checked_${partners?.length || 0}`, `duplicate_found_${duplicates}`],
    };

  } catch (error: any) {
    console.error('[Cron] Duplicate check fatal error:', error);
    return { checked: 0, duplicates: 0, actions: ['duplicate_check_error'] };
  }
}
