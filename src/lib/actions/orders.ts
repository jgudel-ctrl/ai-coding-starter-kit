"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface TradeOrderItem {
  document_date: string;
  document_number: string;
  description: string;
  article_number: string | null;
  quantity: number;
  unit_price_net: number;
  discount_percent: number | null;
  total_net: number;
  purchase_price: number | null;
}

export async function getPartnerTradeOrders(
  partnerId: string,
  page: number = 1,
  pageSize: number = 20,
  search?: string
) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    let query = supabase
      .from("invoice_items")
      .select(
        `
        description,
        article_number,
        quantity,
        unit_price_net,
        discount_percent,
        total_net,
        purchase_price,
        invoices!inner(document_date, document_number, partner_id)
      `,
        { count: "exact" }
      )
      .eq("invoices.partner_id", partnerId)
      .eq("revenue_category", "trade_goods")
      .not("description", "is", null)
      .order("invoices(document_date)", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`description.ilike.%${search}%,article_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Trade orders fetch error:", error);
      return {
        ok: false,
        error: error.message,
        items: [],
        totalCount: 0,
      } as const;
    }

    // Transformiere die Daten
    const items: TradeOrderItem[] =
      data?.map((item: any) => ({
        document_date: item.invoices?.document_date || "",
        document_number: item.invoices?.document_number || "",
        description: item.description || "",
        article_number: item.article_number,
        quantity: Number(item.quantity) || 0,
        unit_price_net: Number(item.unit_price_net) || 0,
        discount_percent: item.discount_percent ? Number(item.discount_percent) : null,
        total_net: Number(item.total_net) || 0,
        purchase_price: item.purchase_price ? Number(item.purchase_price) : null,
      })) || [];

    return {
      ok: true,
      items,
      totalCount: count || 0,
    } as const;
  } catch (err) {
    console.error("Unexpected error fetching trade orders:", err);
    return {
      ok: false,
      error: "Unerwarteter Fehler",
      items: [],
      totalCount: 0,
    } as const;
  }
}
