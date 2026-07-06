"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type DriverTour = {
  id: string;
  status: string;
  geplantes_abholdatum: string | null;
  tatsaechliches_abholdatum: string | null;
  titel: string | null;
  partner: {
    id: string;
    company_name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
  };
};

export type DriverToursResult =
  | { ok: true; data: DriverTour[] }
  | { ok: false; error: string };

export type UpsertResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Hilfsfunktion: Lädt Partner- und Adressdaten für Tour-Liste
 */
async function enrichToursWithPartnerData(
  serviceClient: any,
  tourData: any[]
): Promise<DriverTour[]> {
  const partnerIds = tourData.map((item: any) => item.partner_id).filter(Boolean);
  
  let partnersMap = new Map<string, any>();
  let addressesMap = new Map<string, any>();
  
  if (partnerIds.length > 0) {
    const { data: partnersData } = await serviceClient
      .from("partners")
      .select("id, company_name")
      .in("id", partnerIds);
    
    if (partnersData) {
      for (const p of partnersData) {
        partnersMap.set(p.id, p);
      }
    }
    
    const { data: addressesData } = await serviceClient
      .from("partner_addresses")
      .select("partner_id, street, postal_code, city")
      .in("partner_id", partnerIds)
      .eq("address_type", "shipping");
    
    if (addressesData) {
      for (const a of addressesData) {
        addressesMap.set(a.partner_id, a);
      }
    }
  }

  return tourData.map((item: any) => {
    const partner = partnersMap.get(item.partner_id);
    const address = addressesMap.get(item.partner_id);
    
    return {
      id: item.id,
      status: item.status,
      geplantes_abholdatum: item.geplantes_abholdatum,
      tatsaechliches_abholdatum: item.tatsaechliches_abholdatum,
      titel: item.titel,
      partner: {
        id: item.partner_id || "",
        company_name: partner?.company_name || "Unbekannt",
        street: address?.street || null,
        zip: address?.postal_code || null,
        city: address?.city || null,
      },
    };
  });
}

/**
 * Lädt alle geplanten Touren für den eingeloggten Fahrer für heute.
 * Filter: fahrer_id = currentUser, geplantes_abholdatum = heute, status = geplant
 */
export async function getDriverToursForToday(): Promise<DriverToursResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Nicht eingeloggt." };
    }

    const serviceClient = createAdminClient({ schema: "tms" });

    // Heutiges Datum im Format YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await serviceClient
      .from("tours")
      .select(`
        id,
        status,
        geplantes_abholdatum,
        tatsaechliches_abholdatum,
        titel,
        partner_id
      `)
      .eq("fahrer_id", user.id)
      .eq("geplantes_abholdatum", today)
      .eq("status", "geplant")
      .order("geplantes_abholdatum", { ascending: true });

    if (error) {
      console.error("[getDriverToursForToday]", error);
      return { ok: false, error: "Konnte Touren nicht laden." };
    }

    const tours = await enrichToursWithPartnerData(serviceClient, data || []);

    return { ok: true, data: tours };
  } catch (err) {
    console.error("[getDriverToursForToday] Exception:", err);
    return { ok: false, error: "Unerwarteter Fehler beim Laden der Touren." };
  }
}

/**
 * Lädt alle geplanten Touren für den eingeloggten Fahrer in einem Datumsbereich.
 * Standard: Nächste 5 Arbeitstage (ohne Wochenenden)
 */
export async function getDriverToursForDateRange(
  workdays: number = 5
): Promise<DriverToursResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Nicht eingeloggt." };
    }

    const serviceClient = createAdminClient({ schema: "tms" });

    // Berechne Start (heute) und Ende (nächste X Arbeitstage)
    const startDate = new Date().toISOString().split("T")[0];
    
    // Berechne Enddatum: nächste X Arbeitstage (überspringe Wochenenden)
    const endDateObj = new Date();
    let daysAdded = 0;
    while (daysAdded < workdays) {
      endDateObj.setDate(endDateObj.getDate() + 1);
      const dayOfWeek = endDateObj.getDay();
      // 0 = Sonntag, 6 = Samstag
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysAdded++;
      }
    }
    const endDate = endDateObj.toISOString().split("T")[0];

    const { data, error } = await serviceClient
      .from("tours")
      .select(`
        id,
        status,
        geplantes_abholdatum,
        tatsaechliches_abholdatum,
        titel,
        partner_id
      `)
      .eq("fahrer_id", user.id)
      .gte("geplantes_abholdatum", startDate)
      .lte("geplantes_abholdatum", endDate)
      .eq("status", "geplant")
      .order("geplantes_abholdatum", { ascending: true });

    if (error) {
      console.error("[getDriverToursForDateRange]", error);
      return { ok: false, error: "Konnte Touren nicht laden." };
    }

    const tours = await enrichToursWithPartnerData(serviceClient, data || []);

    return { ok: true, data: tours };
  } catch (err) {
    console.error("[getDriverToursForDateRange] Exception:", err);
    return { ok: false, error: "Unerwarteter Fehler beim Laden der Touren." };
  }
}

/**
 * Setzt den Status einer Tour auf 'abgeholt'.
 */
export async function markTourAsCollected(tourId: string): Promise<UpsertResult> {
  try {
    const serviceClient = createAdminClient({ schema: "tms" });

    const today = new Date().toISOString().split("T")[0];

    const { error } = await serviceClient
      .from("tours")
      .update({
        status: "erledigt",
        tatsaechliches_abholdatum: today,
        geaendert_am: new Date().toISOString(),
      })
      .eq("id", tourId);

    if (error) {
      console.error("[markTourAsCollected]", error);
      return { ok: false, error: "Konnte Status nicht aktualisieren." };
    }

    revalidatePath("/fahrer");
    return { ok: true };
  } catch (err) {
    console.error("[markTourAsCollected] Exception:", err);
    return { ok: false, error: "Unerwarteter Fehler beim Aktualisieren des Status." };
  }
}
