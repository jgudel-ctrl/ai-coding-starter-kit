"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type DriverOption = {
  id: string;
  full_name: string;
};

export async function getDriversSimple(): Promise<{ ok: true; data: DriverOption[] } | { ok: false; error: string }> {
  try {
    const client = createAdminClient({ schema: "public" });
    
    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, roles")
      .eq("status", "aktiv");
    
    if (error) return { ok: false, error: error.message };
    
    const drivers = (data || [])
      .filter((p: any) => p.roles && JSON.stringify(p.roles).includes('fahrer'))
      .map((p: any) => ({ id: p.id, full_name: p.full_name || "Unbekannt" }))
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
    
    return { ok: true, data: drivers };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
