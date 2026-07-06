"use server";

import { createClient } from "@/lib/supabase/server";

export async function testDrivers() {
  const supabase = await createClient();
  
  // Alle Profile laden
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, roles, status")
    .eq("status", "aktiv");
  
  if (error) {
    console.error("[testDrivers] Error:", error);
    return { ok: false, error: error.message, raw: null };
  }
  
  console.log("[testDrivers] Raw data:", JSON.stringify(data, null, 2));
  
  // Filter-Logik testen
  const drivers = (data ?? []).filter((p: any) => {
    const roles = p.roles;
    console.log(`[testDrivers] Checking ${p.full_name}: roles =`, roles, "type =", typeof roles);
    
    if (!roles) {
      console.log(`[testDrivers] ${p.full_name}: no roles, skipping`);
      return false;
    }
    
    if (typeof roles === 'string') {
      const parsed = roles.replace(/[{}]/g, '').split(',').map((r: string) => r.trim());
      console.log(`[testDrivers] ${p.full_name}: parsed string roles =`, parsed);
      return parsed.includes('fahrer');
    }
    
    if (Array.isArray(roles)) {
      console.log(`[testDrivers] ${p.full_name}: array roles =`, roles);
      return roles.includes('fahrer');
    }
    
    console.log(`[testDrivers] ${p.full_name}: unknown format, skipping`);
    return false;
  });
  
  console.log("[testDrivers] Filtered drivers:", drivers);
  
  return { 
    ok: true, 
    total: data?.length || 0,
    driversFound: drivers.length,
    drivers: drivers.map((d: any) => ({ id: d.id, full_name: d.full_name }))
  };
}
