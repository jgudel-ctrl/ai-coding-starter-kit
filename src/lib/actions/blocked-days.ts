"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { calculateHolidays } from "@/lib/pickup-utils";

export type BlockedPeriod = {
  id: string;
  von_datum: string;
  bis_datum: string;
  grund: string;
  typ: "feiertag" | "manuell";
  erstellt_am: string;
};

export type BlockedPeriodsResult =
  | { ok: true; data: BlockedPeriod[] }
  | { ok: false; error: string };

export type UpsertResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Alle Blocker-Zeiträume laden (inkl. Feiertage)
 * Verwendet Service-Role-Client um RLS zu umgehen —
 * die Seite ist eh Admin-geschützt.
 */
export async function getBlockedPeriods(): Promise<BlockedPeriodsResult> {
  const serviceClient = createAdminClient({ schema: "tms" });

  const { data, error } = await serviceClient
    .from("blocked_days")
    .select("*")
    .order("von_datum", { ascending: true });

  if (error) {
    console.error("[getBlockedPeriods]", error);
    return { ok: false, error: "Konnte Blocker nicht laden." };
  }

  return { ok: true, data: (data || []) as BlockedPeriod[] };
}

/**
 * Feiertage für aktuelles + nächstes Jahr initialisieren (falls noch nicht vorhanden)
 */
export async function initializeHolidays(): Promise<UpsertResult> {
  const serviceClient = createAdminClient({ schema: "tms" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Nicht eingeloggt." };
  }

  // Prüfe Admin-Rechte
  const { data: isAdmin } = await supabase.rpc("is_active_admin");
  if (!isAdmin) {
    return { ok: false, error: "Nur Admins dürfen Feiertage initialisieren." };
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  for (const year of years) {
    const holidays = calculateHolidays(year);

    for (const holiday of holidays) {
      const dateStr = holiday.datum.toISOString().split("T")[0];

      // Prüfe ob bereits vorhanden
      const { data: existing } = await serviceClient
        .from("blocked_days")
        .select("id")
        .eq("von_datum", dateStr)
        .eq("typ", "feiertag")
        .maybeSingle();

      if (!existing) {
        await serviceClient.from("blocked_days").insert({
          von_datum: dateStr,
          bis_datum: dateStr,
          grund: holiday.name,
          typ: "feiertag",
          erstellt_von: user.id,
        });
      }
    }
  }

  return { ok: true };
}

/**
 * Neuen Blocker-Zeitraum hinzufügen (Admin)
 */
export async function addBlockedPeriod(
  vonDatum: string,
  bisDatum: string,
  grund: string,
): Promise<UpsertResult> {
  const serviceClient = createAdminClient({ schema: "tms" });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Nicht eingeloggt." };
  }

  // Prüfe Admin-Rechte
  const { data: isAdmin } = await supabase.rpc("is_active_admin");
  if (!isAdmin) {
    return { ok: false, error: "Nur Admins dürfen Blocker hinzufügen." };
  }

  const { error } = await serviceClient.from("blocked_days").insert({
    von_datum: vonDatum,
    bis_datum: bisDatum,
    grund,
    typ: "manuell",
    erstellt_von: user.id,
  });

  if (error) {
    console.error("[addBlockedPeriod]", error);
    return { ok: false, error: "Hinzufügen fehlgeschlagen." };
  }

  revalidatePath("/verwaltung/abholungskalender");
  return { ok: true };
}

/**
 * Blocker-Zeitraum löschen (Admin)
 */
export async function removeBlockedPeriod(id: string): Promise<UpsertResult> {
  const serviceClient = createAdminClient({ schema: "tms" });

  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_active_admin");

  if (!isAdmin) {
    return { ok: false, error: "Nur Admins dürfen Blocker löschen." };
  }

  const { error } = await serviceClient
    .from("blocked_days")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[removeBlockedPeriod]", error);
    return { ok: false, error: "Löschen fehlgeschlagen." };
  }

  revalidatePath("/verwaltung/abholungskalender");
  return { ok: true };
}
