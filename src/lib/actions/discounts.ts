/**
 * Rabatte (Discounts) Actions
 * 
 * Holt Rabatte eines Partners aus partner_discounts + position_groups.
 * Schema: tms (wie alle bestehenden Features)
 */

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/supabase/server";
import { updateEasybillDiscount } from "@/lib/easybill/discounts";

export interface PartnerDiscount {
  id: string;
  partner_id?: string;
  easybill_discount_id: number | null;
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

export async function getPartnerDiscounts(
  partnerId: string
): Promise<PartnerDiscountsResult> {
  try {
    // Schema tms — konsistent mit allen bestehenden Features
    const supabase = createAdminClient({ schema: "tms" });

    const { data: discounts, error: discountsError } = await supabase
      .from("partner_discounts")
      .select("id, partner_id, easybill_discount_id, position_group_id, position_group_name, position_group_number, discount_percent, discount_type, created_at")
      .eq("partner_id", partnerId)
      .order("position_group_name", { ascending: true });

    if (discountsError) {
      console.error("Error fetching partner discounts:", discountsError);
      return { ok: false, error: discountsError.message };
    }

    const { data: positionGroups, error: pgError } = await supabase
      .from("position_groups")
      .select("id, name, display_name, number, description")
      .order("name", { ascending: true });

    if (pgError) {
      console.error("Error fetching position groups:", pgError);
    }

    return {
      ok: true,
      data: {
        discounts: discounts || [],
        positionGroups: positionGroups || [],
      },
    };

  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

export async function updatePartnerDiscount(
  partnerId: string,
  discountId: string,
  newPercent: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Admin-Check (server-seitig, nicht nur UI)
    const profile = await getCurrentProfile();
    const isAdmin = profile?.roles?.includes("admin") ?? false;
    if (!isAdmin) {
      return { ok: false, error: "Keine Berechtigung — nur Admin darf Rabatte ändern." };
    }

    // 2. Rabatt laden (alten Wert merken + Easybill-ID)
    const supabase = createAdminClient({ schema: "tms" });

    const { data: discount, error: fetchError } = await supabase
      .from("partner_discounts")
      .select("easybill_discount_id, position_group_id, partner_id, discount_percent, raw_easybill_payload")
      .eq("id", discountId)
      .single();

    if (fetchError || !discount) {
      return { ok: false, error: "Rabatt nicht gefunden." };
    }

    // 3. TMS DB aktualisieren
    const oldPercent = discount.discount_percent;
    const { error: updateError } = await supabase
      .from("partner_discounts")
      .update({ discount_percent: newPercent })
      .eq("id", discountId);

    if (updateError) {
      return { ok: false, error: "Datenbank-Fehler: " + updateError.message };
    }

    // 4. Easybill-Sync (falls easybill_discount_id vorhanden)
    if (discount.easybill_discount_id && discount.raw_easybill_payload?.customer_id) {
      const ebResult = await updateEasybillDiscount(
        discount.easybill_discount_id,
        discount.raw_easybill_payload.customer_id,
        discount.position_group_id!,
        newPercent
      );

      if (!ebResult.ok) {
        // 5. Rollback bei Easybill-Fehler
        await supabase
          .from("partner_discounts")
          .update({ discount_percent: oldPercent })
          .eq("id", discountId);

        return {
          ok: false,
          error: `Easybill-Sync fehlgeschlagen — Änderung wurde zurückgesetzt. (${ebResult.error})`,
        };
      }
    }

    return { ok: true };
  } catch (error: any) {
    console.error("[updatePartnerDiscount] Error:", error);
    return { ok: false, error: error.message };
  }
}

export async function getPartnerDiscountCount(
  partnerId: string
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const supabase = createAdminClient({ schema: "tms" });

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
