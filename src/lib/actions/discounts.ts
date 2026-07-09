/**
 * Rabatte (Discounts) Actions
 * 
 * Holt Rabatte eines Partners aus partner_discounts + position_groups.
 * Admin kann Rabatte nicht direkt editieren (kommen von Easybill).
 * Vollständiger Voll-Replace bei jedem Easybill-Sync.
 */

"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface PartnerDiscount {
  id: string;
  position_group_id: number | null;
  position_group_name: string | null;
  position_group_number: string | null;
  discount_percent: number | null;
  discount_type: string | null;
  created_at: string;
}

export interface PositionGroup {
  id: number;
  name: string;
  display_name: string | null;
  number: string | null;
  description: string | null;
}

export interface PartnerDiscountsResult {
  ok: boolean;
  data?: {
    discounts: PartnerDiscount[];
    positionGroups: PositionGroup[];
  };
  error?: string;
}

/**
 * Rabatte eines Partners holen
 */
export async function getPartnerDiscounts(
  partnerId: string
): Promise<PartnerDiscountsResult> {
  try {
    const supabase = createAdminClient();

    // Rabatte des Partners
    const { data: discounts, error: discountsError } = await supabase
      .from("partner_discounts")
      .select("id, position_group_id, position_group_name, position_group_number, discount_percent, discount_type, created_at")
      .eq("partner_id", partnerId)
      .order("position_group_name", { ascending: true });

    if (discountsError) {
      console.error("Error fetching partner discounts:", discountsError);
      return { ok: false, error: discountsError.message };
    }

    // Alle Produktgruppen (für Kontext — welche Gruppen HABEN KEINE Rabatte)
    const { data: positionGroups, error: pgError } = await supabase
      .from("position_groups")
      .select("id, name, display_name, number, description")
      .order("name", { ascending: true });

    if (pgError) {
      console.error("Error fetching position groups:", pgError);
      // Nicht fatal — Rabatte trotzdem zurückgeben
    }

    return {
      ok: true,
      data: {
        discounts: discounts || [],
        positionGroups: positionGroups || [],
      },
    };

  } catch (error: any) {
    console.error("Error in getPartnerDiscounts:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Statistik: Wie viele Rabatte hat dieser Partner?
 */
export async function getPartnerDiscountCount(
  partnerId: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { count, error } = await supabase
      .from("partner_discounts")
      .select("*", { count: "exact", head: true })
      .eq("partner_id", partnerId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, count: count || 0 };

  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}
