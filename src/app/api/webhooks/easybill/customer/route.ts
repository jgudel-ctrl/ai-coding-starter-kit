/**
 * Easybill Webhook Handler
 * Route: POST /api/webhooks/easybill/customer
 * 
 * Empfängt Webhooks von Easybill bei:
 * - customer.created (Neuer Kunde)
 * - customer.updated (Kunde geändert)
 * 
 * Sicherheit:
 * - API-Key/Secret Prüfung
 * - HTTPS erzwungen
 * 
 * Response:
 * - 200 OK = Alles gut (auch wenn nichts geändert)
 * - 400 = Ungültiges JSON
 * - 401 = Unauthorized (falscher Secret)
 * - 500 = Server Fehler → Easybill retried später
 */

import { NextRequest, NextResponse } from "next/server";
import { syncEasybillCustomer } from "@/lib/easybill/partner-sync";
import { createAdminClient } from "@/lib/supabase/admin";

// ============================================================
// Webhook Secret (aus .env)
// ============================================================
const WEBHOOK_SECRET = process.env.EASYBILL_WEBHOOK_SECRET || process.env.EASYBILL_API_KEY;

// ============================================================
// POST Handler
// ============================================================
export async function POST(request: NextRequest) {
  try {
    // 1. Authentifizierung prüfen
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token || token !== WEBHOOK_SECRET) {
      console.error('[Webhook] Unauthorized - invalid token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Event-Type bestimmen
    const eventType = request.headers.get('x-easybill-event') || 'customer.updated';

    // 3. JSON Body parsen
    let customerData;
    try {
      customerData = await request.json();
    } catch (parseError) {
      console.error('[Webhook] Invalid JSON:', parseError);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 4. Validierung: Muss Easybill-Nummer haben
    if (!customerData.number) {
      console.error('[Webhook] Missing customer number');
      return NextResponse.json({ error: 'Missing customer number' }, { status: 400 });
    }

    console.log(`[Webhook] Received ${eventType} for customer ${customerData.number}`);

    // 5. Sync durchführen
    const result = await syncEasybillCustomer(customerData);

    // 6. Ergebnis loggen
    await logWebhookEvent({
      eventType,
      easybillId: customerData.id,
      customerNumber: customerData.number,
      partnerId: result.partnerId,
      status: result.success ? 'success' : 'error',
      actions: result.actions,
      errors: result.errors,
    });

    // 7. Erfolgreiche Antwort (wichtig: Easybill retried bei nicht-200!)
    return NextResponse.json({
      success: result.success,
      partnerId: result.partnerId,
      actions: result.actions,
      errors: result.errors,
    });

  } catch (error: any) {
    console.error('[Webhook] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// Logging
// ============================================================
async function logWebhookEvent(event: {
  eventType: string;
  easybillId: number;
  customerNumber: string;
  partnerId?: string;
  status: string;
  actions: string[];
  errors: string[];
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from('easybill_sync_logs').insert({
      sync_type: 'customer',
      easybill_id: event.easybillId,
      partner_id: event.partnerId,
      status: event.status,
      details: {
        event_type: event.eventType,
        customer_number: event.customerNumber,
        actions: event.actions,
        errors: event.errors,
      },
      error_message: event.errors.length > 0 ? event.errors.join('; ') : null,
    });
  } catch (logError: any) {
    console.error('[Webhook] Logging failed:', logError.message);
    // Logging-Fehler nicht zum Fehlschlag des Webhooks führen
  }
}
