"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type {
  INBOUND_OPTIONS,
  OUTBOUND_OPTIONS,
  PICKUP_STATUS_OPTIONS,
} from "./order-defaults-shared";

// ─── Types ───────────────────────────────────────────────

export type OrderDefault = {
  id: string;
  partner_id: string;
  inbound_type: string | null;
  outbound_type: string | null;
  pickup_delivery_status: string | null;
  driver_id: string | null;
  pickup_cycle_count: number | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DriverOption = {
  id: string;
  full_name: string;
};

export type OrderDefaultResult =
  | { ok: true; data: OrderDefault | null }
  | { ok: false; error: string };

export type DriversResult =
  | { ok: true; data: DriverOption[] }
  | { ok: false; error: string };

export type UpsertResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── READ: Auftrags-Default für einen Kunden laden ───────

export async function getPartnerOrderDefault(
  partnerId: string,
): Promise<OrderDefaultResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("tms")
    .from("partner_order_defaults")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (error) {
    console.error("[getPartnerOrderDefault]", error);
    return { ok: false, error: "Konnte Auftrags-Default nicht laden." };
  }

  return { ok: true, data: data as OrderDefault | null };
}

// ─── READ: Alle aktiven Fahrer laden ─────────────────────

export async function getDrivers(): Promise<DriversResult> {
  const supabase = await createClient();

  // profiles-Tabelle ist im public Schema, roles ist ein Array
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("status", "aktiv");

  if (error) {
    console.error("[getDrivers]", error);
    return { ok: false, error: "Konnte Fahrer nicht laden." };
  }

  // Filtere nur Profile, die die Rolle "fahrer" haben
  const drivers: DriverOption[] = (data ?? [])
    .filter((p: any) => p.roles && Array.isArray(p.roles) && p.roles.includes("fahrer"))
    .map((p: any) => ({
      id: p.id,
      full_name: p.full_name || "Unbekannt",
    }));

  // Alphabetisch sortieren
  drivers.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return { ok: true, data: drivers };
}

// ─── WRITE: Auftrags-Default erstellen/aktualisieren ─────

export async function upsertPartnerOrderDefault(
  partnerId: string,
  values: {
    inbound_type: string;
    outbound_type: string;
    pickup_delivery_status: string;
    driver_id?: string | null;
    pickup_cycle_count?: number | null;
  },
): Promise<UpsertResult> {
  // Admin-Check auf Serverseite
  const supabase = await createClient();
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_active_admin");

  if (adminError || !isAdmin) {
    return { ok: false, error: "Nur Admins dürfen Auftrags-Defaults bearbeiten." };
  }

  // Service-Role für Schreibzugriff (tms-Schema)
  const serviceClient = createAdminClient({ schema: "tms" });

  // Validierung: driver_id Pflicht bei bestimmten Kombinationen
  const needsDriver =
    values.inbound_type === "Abholservice durch Gudel Werkzeuge" ||
    values.outbound_type === "Bringen";

  if (needsDriver && !values.driver_id) {
    return { ok: false, error: "Fahrer ist bei Abholservice oder 'Bringen' erforderlich." };
  }

  // Prüfen ob Eintrag existiert
  const { data: existing } = await serviceClient
    .from("partner_order_defaults")
    .select("id")
    .eq("partner_id", partnerId)
    .maybeSingle();

  const payload = {
    partner_id: partnerId,
    inbound_type: values.inbound_type,
    outbound_type: values.outbound_type,
    pickup_delivery_status: values.pickup_delivery_status,
    driver_id: values.driver_id || null,
    pickup_cycle_count: values.pickup_cycle_count || null,
  };

  let error;
  if (existing) {
    // Update
    ({ error } = await serviceClient
      .from("partner_order_defaults")
      .update(payload)
      .eq("partner_id", partnerId));
  } else {
    // Insert
    ({ error } = await serviceClient
      .from("partner_order_defaults")
      .insert(payload));
  }

  if (error) {
    console.error("[upsertPartnerOrderDefault]", error);
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  revalidatePath(`/kunden/${partnerId}`);
  return { ok: true };
}
