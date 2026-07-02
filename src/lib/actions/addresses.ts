"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

    return { ok: true } as const;
  } catch (err) {
    console.error("Unexpected error updating address:", err);
    return { ok: false, error: "Unerwarteter Fehler" } as const;
  }
}
