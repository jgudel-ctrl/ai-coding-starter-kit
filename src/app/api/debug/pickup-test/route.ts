import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET() {
  const client = createAdminClient({ schema: "tms" });
  
  // 1. Prüfe Supabase-Verbindung
  const { data: testData, error: testError } = await client
    .from("partners")
    .select("id, display_name")
    .limit(1);
    
  if (testError) {
    return NextResponse.json({
      error: "Supabase connection failed",
      details: testError.message,
    }, { status: 500 });
  }
    
  // 2. Prüfe Blocked Days Tabelle
  const { data: blockedDays, error: blockedError } = await client
    .from("blocked_days")
    .select("count")
    .single();
    
  // 3. Prüfe Tours für Büsken
  const { data: tours, error: toursError } = await client
    .from("tours")
    .select("id, partner_id, status, geplantes_abholdatum")
    .eq("status", "geplant")
    .limit(5);
    
  // 4. Finde Büsken
  const { data: busken, error: buskenError } = await client
    .from("partners")
    .select("id, display_name")
    .ilike("display_name", "%büsken%")
    .limit(2);
    
  // 5. Prüfe Order Defaults für Büsken
  let defaults = null;
  let defaultsError = null;
  if (busken && busken.length > 0) {
    const result = await client
      .from("partner_order_defaults")
      .select("*")
      .eq("partner_id", busken[0].id)
      .maybeSingle();
    defaults = result.data;
    defaultsError = result.error;
  }

  return NextResponse.json({
    supabase_connected: !testError,
    first_partner: testData?.[0]?.display_name || null,
    blocked_days_count: blockedDays?.count || 0,
    blocked_days_error: blockedError?.message || null,
    geplante_touren: tours?.length || 0,
    tours_error: toursError?.message || null,
    busken_gefunden: busken?.length || 0,
    busken_error: buskenError?.message || null,
    busken_defaults: defaults,
    busken_defaults_error: defaultsError?.message || null,
  });
}
