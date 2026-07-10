/**
 * Easybill API — Position Group Discounts
 *
 * PUT /discounts/position-group/{id}
 * Payload: { customer_id, position_group_id, discount, discount_type }
 */

"use server";

import { easybillFetch } from "./client";

export interface EasybillDiscount {
  id: number;
  customer_id: number;
  position_group_id: number;
  discount: number;
  discount_type: "PERCENT" | "AMOUNT";
}

/**
 * Rabatt in Easybill aktualisieren.
 *
 * @param easybillDiscountId Easybill Rabatt-ID
 * @param customerId Easybill Kunden-ID
 * @param positionGroupId Easybill Produktgruppen-ID
 * @param discountPercent Neuer Rabatt-Prozentsatz (0-100)
 */
export async function updateEasybillDiscount(
  easybillDiscountId: number,
  customerId: number,
  positionGroupId: number,
  discountPercent: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload = {
      customer_id: customerId,
      position_group_id: positionGroupId,
      discount: discountPercent,
      discount_type: "PERCENT" as const,
    };

    await easybillFetch(`/discounts/position-group/${easybillDiscountId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    return { ok: true };
  } catch (error: any) {
    console.error("[Easybill] PUT discount failed:", error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Rabatt in Easybill löschen.
 */
export async function deleteEasybillDiscount(
  easybillDiscountId: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    await easybillFetch(`/discounts/position-group/${easybillDiscountId}`, {
      method: "DELETE",
    });
    return { ok: true };
  } catch (error: any) {
    console.error("[Easybill] DELETE discount failed:", error.message);
    return { ok: false, error: error.message };
  }
}
