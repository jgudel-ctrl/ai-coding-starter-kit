"use server";

import { createClient } from "@/lib/supabase/server";

export interface MonthlyRevenue {
  month: number;
  revenue_service: number;
  revenue_retail: number;
  revenue_custom: number;
  revenue_total: number;
  gross_profit: number;
  invoice_count: number;
}

export async function getPartnerRevenue(partnerId: string, year: number) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("mv_partner_monthly_revenue")
      .select(
        "month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count"
      )
      .eq("partner_id", partnerId)
      .eq("year", year)
      .order("month", { ascending: true });

    if (error) {
      console.error("Revenue fetch error:", error);
      return { ok: false, error: error.message, data: [] } as const;
    }

    // Alle 12 Monate sicherstellen (fehlende Monate mit 0 auffüllen)
    const monthMap = new Map();
    for (let i = 1; i <= 12; i++) {
      monthMap.set(i, {
        month: i,
        revenue_service: 0,
        revenue_retail: 0,
        revenue_custom: 0,
        revenue_total: 0,
        gross_profit: 0,
        invoice_count: 0,
      });
    }

    for (const row of data || []) {
      monthMap.set(row.month, {
        month: row.month,
        revenue_service: Number(row.revenue_service) || 0,
        revenue_retail: Number(row.revenue_retail) || 0,
        revenue_custom: Number(row.revenue_custom) || 0,
        revenue_total: Number(row.revenue_total) || 0,
        gross_profit: Number(row.gross_profit) || 0,
        invoice_count: Number(row.invoice_count) || 0,
      });
    }

    const result: MonthlyRevenue[] = Array.from(monthMap.values());

    return { ok: true, data: result } as const;
  } catch (err) {
    console.error("Unexpected error fetching revenue:", err);
    return { ok: false, error: "Unerwarteter Fehler", data: [] } as const;
  }
}

export async function getAvailableRevenueYears(partnerId: string) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("mv_partner_monthly_revenue")
      .select("year")
      .eq("partner_id", partnerId)
      .order("year", { ascending: false });

    if (error) {
      console.error("Years fetch error:", error);
      return { ok: false, error: error.message, years: [] } as const;
    }

    const uniqueYears = [...new Set((data || []).map((d) => d.year))];
    return { ok: true, years: uniqueYears } as const;
  } catch (err) {
    console.error("Unexpected error fetching years:", err);
    return { ok: false, error: "Unerwarteter Fehler", years: [] } as const;
  }
}
