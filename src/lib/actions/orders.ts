"use server";

import { createClient } from "@/lib/supabase/server";

export interface TradeOrderItem {
  document_date: string;
  document_number: string;
  title: string;
  item_number: string | null;
  quantity: number;
  unit_price: number;
  discount: number | null;
  total_price: number;
  cost_price: number | null;
}

export async function getPartnerTradeOrders(
  partnerId: string,
  page: number = 1,
  pageSize: number = 20,
  search?: string
) {
  try {
    const supabase = await createClient();

    // Zuerst die Gesamtanzahl ermitteln
    let countQuery = supabase
      .from("invoice_items")
      .select("id", { count: "exact", head: true })
      .eq("revenue_category", "trade")
      .not("title", "is", null);

    // Dann die Daten abrufen (mit Join über invoice_id)
    let query = supabase
      .from("invoice_items")
      .select(
        `
        title,
        item_number,
        quantity,
        unit_price,
        discount,
        total_price,
        cost_price,
        invoices!inner(document_date, document_number, partner_id)
      `
      )
      .eq("invoices.partner_id", partnerId)
      .eq("revenue_category", "trade")
      .not("title", "is", null)
      .order("invoices(document_date)", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(`title.ilike.%${search}%,item_number.ilike.%${search}%`);
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
        title: item.title || "",
        item_number: item.item_number,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
        discount: item.discount ? Number(item.discount) : null,
        total_price: Number(item.total_price) || 0,
        cost_price: item.cost_price ? Number(item.cost_price) : null,
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
