"use server";

import { createClient } from "@/lib/supabase/server";

// Types für tms.partners (easybill Kunden)
export type Partner = {
  id: string;
  partner_number: string | null;
  easybill_customer_number: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  vat_identifier: string | null;
  tax_number: string | null;
  is_active: boolean | null;
  is_archived: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

export type PartnerAddress = {
  id: string;
  partner_id: string;
  address_type: string;
  is_default: boolean | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  additional_line: string | null;
  postal_code: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export type PartnerContact = {
  id: string;
  partner_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  role: string | null;
  is_primary: boolean | null;
};

export type PartnerActionResult =
  | { ok: true; data: any }
  | { ok: false; error: string };

/**
 * Alle Partners (Kunden) laden mit optionaler Suche
 */
export async function getPartners(
  search?: string,
  status?: "aktiv" | "inaktiv",
): Promise<{ ok: true; data: Partner[] } | { ok: false; error: string }> {
  const supabase = await createClient();

  let query = supabase
    .schema("tms")
    .from("partners")
    .select("*")
    .order("display_name", { ascending: true });

  // Status-Filter
  if (status === "aktiv") {
    query = query.eq("is_active", true).eq("is_archived", false);
  } else if (status === "inaktiv") {
    query = query.or("is_active.eq.false,is_archived.eq.true");
  }

  // Suche
  if (search) {
    query = query.or(
      `company_name.ilike.%${search}%,display_name.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[getPartners]", error);
    return { ok: false, error: "Konnte Kunden nicht laden." };
  }

  return { ok: true, data: data ?? [] };
}

/**
 * Einzelnen Partner mit Adressen und Kontakten laden
 */
export async function getPartnerById(
  id: string,
): Promise<
  | { ok: true; partner: Partner; addresses: PartnerAddress[]; contacts: PartnerContact[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  // Partner laden
  const { data: partner, error: partnerError } = await supabase
    .schema("tms")
    .from("partners")
    .select("*")
    .eq("id", id)
    .single();

  if (partnerError || !partner) {
    console.error("[getPartnerById]", partnerError);
    return { ok: false, error: "Kunde nicht gefunden." };
  }

  // Adressen laden
  const { data: addresses, error: addrError } = await supabase
    .schema("tms")
    .from("partner_addresses")
    .select("*")
    .eq("partner_id", id)
    .order("is_default", { ascending: false });

  if (addrError) {
    console.error("[getPartnerById] Adressen:", addrError);
  }

  // Kontakte laden
  const { data: contacts, error: contactError } = await supabase
    .schema("tms")
    .from("partner_contacts")
    .select("*")
    .eq("partner_id", id)
    .order("is_primary", { ascending: false });

  if (contactError) {
    console.error("[getPartnerById] Kontakte:", contactError);
  }

  return {
    ok: true,
    partner,
    addresses: addresses ?? [],
    contacts: contacts ?? [],
  };
}

/**
 * Partner-Anzahl für Statistik
 */
export async function getPartnerCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .schema("tms")
    .from("partners")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("[getPartnerCount]", error);
    return 0;
  }

  return count ?? 0;
}
