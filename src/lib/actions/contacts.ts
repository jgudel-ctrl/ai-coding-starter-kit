"use server";

import { createClient } from "@/lib/supabase/server";

export interface ContactCreateInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  role?: string;
  notes?: string;
}

export async function getPartnerContacts(partnerId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("partner_contacts")
      .select("*")
      .eq("partner_id", partnerId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Contacts fetch error:", error);
      return { ok: false, error: error.message, contacts: [] } as const;
    }

    return { ok: true, contacts: data || [] } as const;
  } catch (err) {
    console.error("Unexpected error fetching contacts:", err);
    return { ok: false, error: "Unerwarteter Fehler", contacts: [] } as const;
  }
}

export async function createPartnerContact(
  partnerId: string,
  data: ContactCreateInput
) {
  try {
    const supabase = await createClient();

    const displayName = `${data.first_name || ""} ${data.last_name || ""}`.trim();

    const { data: contact, error } = await supabase
      .from("partner_contacts")
      .insert({
        partner_id: partnerId,
        first_name: data.first_name,
        last_name: data.last_name,
        display_name: displayName || null,
        email: data.email || null,
        phone: data.phone || null,
        mobile: data.mobile || null,
        role: data.role || null,
        notes: data.notes || null,
        is_primary: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Contact create error:", error);
      return { ok: false, error: error.message } as const;
    }

    return { ok: true, contact } as const;
  } catch (err) {
    console.error("Unexpected error creating contact:", err);
    return { ok: false, error: "Unerwarteter Fehler" } as const;
  }
}
