"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGroupStats,
  escapeOrFilterValue,
  type OrderGroupStat,
  type ProductGroupInfo,
} from "./orders-helpers";

export type { OrderGroupStat };

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
  group_id: number | null;
  group_name: string | null;
}

/**
 * Lädt die Artikel (type='PRODUCT') als Map article_number -> { group_id, group_name }.
 * invoice_items.article_number ist nicht per FK mit products.number verknüpft
 * (unterschiedliche Herkunft der Daten), daher zweistufiger Join in der App-Schicht.
 */
async function getProductGroupMap(
  supabase: ReturnType<typeof createAdminClient>,
  groupId?: number
) {
  let query = supabase
    .from("products")
    .select("number, group_id")
    .eq("type", "PRODUCT")
    .not("number", "is", null);

  if (groupId !== undefined) {
    query = query.eq("group_id", groupId);
  }

  const { data: products, error } = await query;
  if (error) throw error;

  const groupIds = [...new Set((products || []).map((p: any) => p.group_id).filter(Boolean))];

  let groupNames = new Map<number, string>();
  if (groupIds.length > 0) {
    const { data: groups, error: groupsError } = await supabase
      .from("position_groups")
      .select("id, name")
      .in("id", groupIds);
    if (groupsError) throw groupsError;
    for (const g of groups || []) {
      groupNames.set(g.id, g.name);
    }
  }

  const numberToGroup = new Map<string, ProductGroupInfo>();
  for (const p of products || []) {
    numberToGroup.set(p.number, {
      group_id: p.group_id ?? null,
      group_name: p.group_id ? groupNames.get(p.group_id) ?? null : null,
    });
  }

  return numberToGroup;
}

export async function getPartnerTradeOrders(
  partnerId: string,
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  groupId?: number
) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    // Nur Positionen, deren Artikel als "echtes Produkt" (type=PRODUCT) geführt wird.
    const numberToGroup = await getProductGroupMap(supabase, groupId);
    const qualifyingNumbers = [...numberToGroup.keys()];

    if (qualifyingNumbers.length === 0) {
      return { ok: true, items: [] as TradeOrderItem[], totalCount: 0 } as const;
    }

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
      .in("article_number", qualifyingNumbers)
      .order("invoices(document_date)", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      const escaped = escapeOrFilterValue(search);
      query = query.or(`description.ilike."%${escaped}%",article_number.ilike."%${escaped}%"`);
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

    const items: TradeOrderItem[] =
      data?.map((item: any) => {
        const group = numberToGroup.get(item.article_number || "");
        return {
          document_date: item.invoices?.document_date || "",
          document_number: item.invoices?.document_number || "",
          description: item.description || "",
          article_number: item.article_number,
          quantity: Number(item.quantity) || 0,
          unit_price_net: Number(item.unit_price_net) || 0,
          discount_percent: item.discount_percent ? Number(item.discount_percent) : null,
          total_net: Number(item.total_net) || 0,
          purchase_price: item.purchase_price ? Number(item.purchase_price) : null,
          group_id: group?.group_id ?? null,
          group_name: group?.group_name ?? null,
        };
      }) || [];

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

/**
 * Aggregiert die Bestellpositionen eines Kunden nach Artikelgruppe —
 * über die gesamte Historie (nicht paginiert), für Donut-Chart + Dropdown.
 * Nur Gruppen mit mindestens einer Position werden zurückgegeben.
 */
export async function getPartnerOrderGroupStats(partnerId: string, search?: string) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    const numberToGroup = await getProductGroupMap(supabase);
    const qualifyingNumbers = [...numberToGroup.keys()];

    if (qualifyingNumbers.length === 0) {
      return { ok: true, data: [] as OrderGroupStat[] } as const;
    }

    let query = supabase
      .from("invoice_items")
      .select(
        `
        article_number,
        invoices!inner(partner_id)
      `
      )
      .eq("invoices.partner_id", partnerId)
      .eq("revenue_category", "trade_goods")
      .not("description", "is", null)
      .in("article_number", qualifyingNumbers);

    if (search) {
      const escaped = escapeOrFilterValue(search);
      query = query.or(`description.ilike."%${escaped}%",article_number.ilike."%${escaped}%"`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = buildGroupStats(
      (data || []).map((item: any) => item.article_number),
      numberToGroup
    );

    return { ok: true, data: stats } as const;
  } catch (err) {
    console.error("Order group stats fetch error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unerwarteter Fehler",
      data: [] as OrderGroupStat[],
    } as const;
  }
}
