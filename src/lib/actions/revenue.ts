"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export interface MonthlyRevenue {
  month: number;
  revenue_service: number;
  revenue_retail: number;
  revenue_custom: number;
  revenue_total: number;
  gross_profit: number;
  invoice_count: number;
}

export interface YearlyRevenue {
  year: number;
  revenue_service: number;
  revenue_retail: number;
  revenue_custom: number;
  revenue_total: number;
  gross_profit: number;
  invoice_count: number;
}

function normalizeMonthlyData(data: any[] | null): MonthlyRevenue[] {
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

  return Array.from(monthMap.values());
}

function calculateTotals(data: MonthlyRevenue[]) {
  return data.reduce(
    (acc, item) => ({
      revenue_service: acc.revenue_service + item.revenue_service,
      revenue_retail: acc.revenue_retail + item.revenue_retail,
      revenue_custom: acc.revenue_custom + item.revenue_custom,
      revenue_total: acc.revenue_total + item.revenue_total,
      gross_profit: acc.gross_profit + item.gross_profit,
      invoice_count: acc.invoice_count + item.invoice_count,
    }),
    {
      revenue_service: 0,
      revenue_retail: 0,
      revenue_custom: 0,
      revenue_total: 0,
      gross_profit: 0,
      invoice_count: 0,
    }
  );
}

// LEGACY: Wird noch von page.tsx verwendet
export async function getPartnerRevenue(partnerId: string, year: number) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

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

    const result = normalizeMonthlyData(data);
    return { ok: true, data: result } as const;
  } catch (err) {
    console.error("Unexpected error fetching revenue:", err);
    return { ok: false, error: "Unerwarteter Fehler", data: [] } as const;
  }
}

// NEU: Lädt aktuelles Jahr + Vorjahr parallel
export async function getPartnerRevenueWithComparison(
  partnerId: string,
  year: number
) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    const [currentResult, previousResult] = await Promise.all([
      supabase
        .from("mv_partner_monthly_revenue")
        .select(
          "month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count"
        )
        .eq("partner_id", partnerId)
        .eq("year", year)
        .order("month", { ascending: true }),
      supabase
        .from("mv_partner_monthly_revenue")
        .select(
          "month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count"
        )
        .eq("partner_id", partnerId)
        .eq("year", year - 1)
        .order("month", { ascending: true }),
    ]);

    const currentData = normalizeMonthlyData(currentResult.data);
    const previousData = normalizeMonthlyData(previousResult.data);
    const previousTotals = calculateTotals(previousData);

    return {
      ok: true,
      currentData,
      previousData,
      previousTotals,
      hasPreviousYear: (previousResult.data?.length || 0) > 0,
    } as const;
  } catch (err) {
    console.error("Unexpected error fetching revenue comparison:", err);
    return {
      ok: false,
      error: "Unerwarteter Fehler",
      currentData: [] as MonthlyRevenue[],
      previousData: [] as MonthlyRevenue[],
      previousTotals: {
        revenue_service: 0,
        revenue_retail: 0,
        revenue_custom: 0,
        revenue_total: 0,
        gross_profit: 0,
        invoice_count: 0,
      },
      hasPreviousYear: false,
    } as const;
  }
}

// NEU: Alle Jahre aggregiert
export async function getPartnerYearlyRevenue(partnerId: string) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    const { data, error } = await supabase
      .from("mv_partner_monthly_revenue")
      .select(
        "year, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count"
      )
      .eq("partner_id", partnerId)
      .order("year", { ascending: true });

    if (error) {
      console.error("Yearly revenue fetch error:", error);
      return { ok: false, error: error.message, years: [] } as const;
    }

    // Gruppiere nach Jahr und summiere
    const yearlyMap = new Map<number, YearlyRevenue>();
    for (const row of data || []) {
      const year = row.year;
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, {
          year,
          revenue_service: 0,
          revenue_retail: 0,
          revenue_custom: 0,
          revenue_total: 0,
          gross_profit: 0,
          invoice_count: 0,
        });
      }
      const existing = yearlyMap.get(year)!;
      existing.revenue_service += Number(row.revenue_service) || 0;
      existing.revenue_retail += Number(row.revenue_retail) || 0;
      existing.revenue_custom += Number(row.revenue_custom) || 0;
      existing.revenue_total += Number(row.revenue_total) || 0;
      existing.gross_profit += Number(row.gross_profit) || 0;
      existing.invoice_count += Number(row.invoice_count) || 0;
    }

    const years = Array.from(yearlyMap.values()).sort((a, b) => a.year - b.year);
    return { ok: true, years } as const;
  } catch (err) {
    console.error("Unexpected error fetching yearly revenue:", err);
    return { ok: false, error: "Unerwarteter Fehler", years: [] } as const;
  }
}

export async function getAvailableRevenueYears(partnerId: string) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

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

export interface RollingMonth {
  label: string;
  year: number;
  month: number;
  revenue_service: number;
  revenue_retail: number;
  revenue_custom: number;
  revenue_total: number;
  gross_profit: number;
  invoice_count: number;
}

export interface RollingRevenueResult {
  ok: boolean;
  currentPeriod: RollingMonth[];
  previousPeriod: RollingMonth[];
  hasPreviousPeriod: boolean;
  error?: string;
}

function createEmptyMonth(year: number, month: number, label: string): RollingMonth {
  return {
    label,
    year,
    month,
    revenue_service: 0,
    revenue_retail: 0,
    revenue_custom: 0,
    revenue_total: 0,
    gross_profit: 0,
    invoice_count: 0,
  };
}

function formatMonthLabel(year: number, month: number): string {
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const yearShort = year.toString().slice(-2);
  return `${months[month - 1]} ${yearShort}`;
}

export async function getPartnerRollingRevenue(partnerId: string): Promise<RollingRevenueResult> {
  try {
    const supabase = createAdminClient({ schema: "tms" });
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Bestimme den neuesten Monat mit Daten
    const { data: latestData } = await supabase
      .from("mv_partner_monthly_revenue")
      .select("year, month")
      .eq("partner_id", partnerId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1);

    let endYear = currentYear;
    let endMonth = currentMonth;

    if (latestData && latestData.length > 0) {
      endYear = latestData[0].year;
      endMonth = latestData[0].month;
    }

    // Berechne Start-Monat (12 Monate zurück)
    let startMonth = endMonth;
    let startYear = endYear;
    
    for (let i = 0; i < 11; i++) {
      startMonth--;
      if (startMonth < 1) {
        startMonth = 12;
        startYear--;
      }
    }

    // Aktuelle Periode: 12 Monate
    const currentPeriodMonths: { year: number; month: number }[] = [];
    let y = startYear;
    let m = startMonth;
    
    for (let i = 0; i < 12; i++) {
      currentPeriodMonths.push({ year: y, month: m });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    const yearsNeeded = [...new Set(currentPeriodMonths.map(p => p.year))];
    
    const { data: currentData } = await supabase
      .from("mv_partner_monthly_revenue")
      .select("year, month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count")
      .eq("partner_id", partnerId)
      .in("year", yearsNeeded)
      .order("year")
      .order("month");

    const currentPeriod: RollingMonth[] = currentPeriodMonths.map(({ year, month }) => {
      const found = currentData?.find(d => d.year === year && d.month === month);
      if (found) {
        return {
          label: formatMonthLabel(year, month),
          year,
          month,
          revenue_service: Number(found.revenue_service) || 0,
          revenue_retail: Number(found.revenue_retail) || 0,
          revenue_custom: Number(found.revenue_custom) || 0,
          revenue_total: Number(found.revenue_total) || 0,
          gross_profit: Number(found.gross_profit) || 0,
          invoice_count: Number(found.invoice_count) || 0,
        };
      }
      return createEmptyMonth(year, month, formatMonthLabel(year, month));
    });

    // Vorherige Periode: 12 Monate davor
    const prevStartYear = startYear - 1;
    const prevEndYear = endYear - 1;
    const prevYearsNeeded = [];
    for (let py = prevStartYear; py <= prevEndYear; py++) {
      prevYearsNeeded.push(py);
    }

    const { data: previousData } = await supabase
      .from("mv_partner_monthly_revenue")
      .select("year, month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count")
      .eq("partner_id", partnerId)
      .in("year", prevYearsNeeded)
      .order("year")
      .order("month");

    const previousPeriod: RollingMonth[] = currentPeriodMonths.map(({ year, month }) => {
      const prevYear = year - 1;
      const found = previousData?.find(d => d.year === prevYear && d.month === month);
      if (found) {
        return {
          label: formatMonthLabel(prevYear, month),
          year: prevYear,
          month,
          revenue_service: Number(found.revenue_service) || 0,
          revenue_retail: Number(found.revenue_retail) || 0,
          revenue_custom: Number(found.revenue_custom) || 0,
          revenue_total: Number(found.revenue_total) || 0,
          gross_profit: Number(found.gross_profit) || 0,
          invoice_count: Number(found.invoice_count) || 0,
        };
      }
      return createEmptyMonth(prevYear, month, formatMonthLabel(prevYear, month));
    });

    const hasPreviousPeriod = !!previousData && previousData.length > 0;

    return {
      ok: true,
      currentPeriod,
      previousPeriod,
      hasPreviousPeriod,
    };
  } catch (err) {
    console.error("Unexpected error fetching rolling revenue:", err);
    return {
      ok: false,
      currentPeriod: [],
      previousPeriod: [],
      hasPreviousPeriod: false,
      error: "Unerwarteter Fehler",
    };
  }
}
