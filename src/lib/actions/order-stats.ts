"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface OrderStats {
  // Aktuelle Periode
  avgRevenuePerOrder: number;
  medianRevenuePerOrder: number;
  totalRevenue: number;
  totalOrders: number;
  // Vorherige Periode
  prevAvgRevenuePerOrder: number;
  prevMedianRevenuePerOrder: number;
  prevTotalRevenue: number;
  prevTotalOrders: number;
  // Verfügbarkeit
  hasPreviousPeriod: boolean;
}

/**
 * Berechnet Umsatz pro Auftrag (Durchschnitt + Median) für einen Kunden.
 * 
 * Logik:
 * - Aufträge = erledigt + archiviert (nur diese haben Umsatz generiert)
 * - Basis-Datum = tatsaechliches_abholdatum (wann wurde tatsächlich abgeholt)
 * - Pro Monat: Umsatz ÷ Aufträge = Durchschnitt dieses Monats
 * - Durchschnitt (Jahr) = Summe(Umsatz) / Summe(Aufträge)
 * - Median (Jahr) = Median der monatlichen Durchschnittswerte
 */
export async function getPartnerOrderStats(
  partnerId: string,
  year: number
): Promise<OrderStats> {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    // 1. Monatliche Umsatzdaten laden
    const { data: revenueData, error: revenueError } = await supabase
      .from("mv_partner_monthly_revenue")
      .select("year, month, revenue_total")
      .eq("partner_id", partnerId)
      .in("year", [year, year - 1])
      .order("year", { ascending: true })
      .order("month", { ascending: true });

    if (revenueError) {
      console.error("Revenue fetch error:", revenueError);
      return createEmptyStats();
    }

    // 2. Monatliche Auftragsanzahl laden
    const { data: orderData, error: orderError } = await supabase
      .from("tours")
      .select("tatsaechliches_abholdatum")
      .eq("partner_id", partnerId)
      .in("status", ["erledigt", "archiviert"]);

    if (orderError) {
      console.error("Order fetch error:", orderError);
      return createEmptyStats();
    }

    // 3. Aufträge nach Jahr/Monat gruppieren
    const orderCounts = new Map<string, number>();
    for (const order of orderData || []) {
      if (!order.tatsaechliches_abholdatum) continue;
      const d = new Date(order.tatsaechliches_abholdatum);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      orderCounts.set(key, (orderCounts.get(key) || 0) + 1);
    }

    // 4. Umsatz nach Jahr/Monat gruppieren
    const revenueByMonth = new Map<string, number>();
    for (const row of revenueData || []) {
      const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
      revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + Number(row.revenue_total));
    }

    // 5. Aktuelle Periode berechnen
    const currentMonthlyValues: number[] = [];
    let currentTotalRevenue = 0;
    let currentTotalOrders = 0;

    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const revenue = revenueByMonth.get(key) || 0;
      const orders = orderCounts.get(key) || 0;

      if (orders > 0 && revenue > 0) {
        currentMonthlyValues.push(revenue / orders);
        currentTotalRevenue += revenue;
        currentTotalOrders += orders;
      }
    }

    const currentAvg = currentTotalOrders > 0 ? currentTotalRevenue / currentTotalOrders : 0;
    const currentMedian = calculateMedian(currentMonthlyValues);

    // 6. Vorherige Periode berechnen
    const prevYear = year - 1;
    const prevMonthlyValues: number[] = [];
    let prevTotalRevenue = 0;
    let prevTotalOrders = 0;

    for (let m = 1; m <= 12; m++) {
      const key = `${prevYear}-${String(m).padStart(2, "0")}`;
      const revenue = revenueByMonth.get(key) || 0;
      const orders = orderCounts.get(key) || 0;

      if (orders > 0 && revenue > 0) {
        prevMonthlyValues.push(revenue / orders);
        prevTotalRevenue += revenue;
        prevTotalOrders += orders;
      }
    }

    const prevAvg = prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0;
    const prevMedian = calculateMedian(prevMonthlyValues);

    return {
      avgRevenuePerOrder: currentAvg,
      medianRevenuePerOrder: currentMedian,
      totalRevenue: currentTotalRevenue,
      totalOrders: currentTotalOrders,
      prevAvgRevenuePerOrder: prevAvg,
      prevMedianRevenuePerOrder: prevMedian,
      prevTotalRevenue,
      prevTotalOrders,
      hasPreviousPeriod: prevTotalOrders > 0,
    };
  } catch (err) {
    console.error("Unexpected error calculating order stats:", err);
    return createEmptyStats();
  }
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function createEmptyStats(): OrderStats {
  return {
    avgRevenuePerOrder: 0,
    medianRevenuePerOrder: 0,
    totalRevenue: 0,
    totalOrders: 0,
    prevAvgRevenuePerOrder: 0,
    prevMedianRevenuePerOrder: 0,
    prevTotalRevenue: 0,
    prevTotalOrders: 0,
    hasPreviousPeriod: false,
  };
}

/**
 * Lädt alle Abholdaten für einen Kunden (für Umsatz/Auftrag-Berechnung).
 */
export async function getPartnerOrderDates(partnerId: string) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    const { data, error } = await supabase
      .from("tours")
      .select("tatsaechliches_abholdatum")
      .eq("partner_id", partnerId)
      .in("status", ["erledigt", "archiviert"])
      .not("tatsaechliches_abholdatum", "is", null);

    if (error) {
      console.error("Order dates fetch error:", error);
      return { ok: false, dates: [] as string[] };
    }

    return {
      ok: true,
      dates: (data || []).map((o) => o.tatsaechliches_abholdatum as string),
    };
  } catch (err) {
    console.error("Unexpected error fetching order dates:", err);
    return { ok: false, dates: [] as string[] };
  }
}
