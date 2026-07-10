"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateAddress, saveValidationResult } from "@/lib/geoapify/validate-address";

export interface AddressUpdateInput {
  company_name?: string;
  first_name?: string;
  last_name?: string;
  street?: string;
  additional_line?: string;
  postal_code?: string;
  city?: string;
  state?: string;
  country?: string;
}

export async function updatePartnerAddress(
  addressId: string,
  data: AddressUpdateInput
) {
  try {
    const supabase = await createClient();

    // 1. Adresse aktualisieren
    const { error } = await supabase
      .from("partner_addresses")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", addressId);

    if (error) {
      console.error("Address update error:", error);
      return { ok: false, error: error.message } as const;
    }

    // 2. Geoapify-Validierung nach dem Update (Regel Ü6)
    console.log("🌍 Starte Geoapify-Validierung nach Adressänderung...");
    const validation = await validateAddress(
      data.street || null,
      data.postal_code || null,
      data.city || null,
      data.country || null
    );

    if (validation.status !== 'error') {
      await saveValidationResult(supabase, addressId, validation);
      console.log("✅ Geoapify-Validierung gespeichert:", validation.status);
    } else {
      console.warn("⚠️ Geoapify-Validierung fehlgeschlagen:", validation.errorMessage);
    }

    return { ok: true } as const;
  } catch (err) {
    console.error("Unexpected error updating address:", err);
    return { ok: false, error: "Unerwarteter Fehler" } as const;
  }
}
