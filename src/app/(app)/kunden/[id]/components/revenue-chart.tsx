"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Wrench,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
} from "lucide-react";
import {
  getPartnerRollingRevenue,
  getPartnerYearlyRevenue,
  RollingMonth,
  YearlyRevenue,
} from "@/lib/actions/revenue";
import { getPartnerOrderDates } from "@/lib/actions/order-stats";

interface RevenueChartProps {
  partnerId: string;
}

type ViewMode = "month" | "year";

function formatMoney(value: number): string {
  return `€${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateTotals(data: RollingMonth[]) {
  return data.reduce(
    (acc, item) => ({
      handel: acc.handel + item.revenue_retail,
      service: acc.service + item.revenue_service,
      custom: acc.custom + item.revenue_custom,
      total: acc.total + item.revenue_total,
      invoices: acc.invoices + item.invoice_count,
    }),
    { handel: 0, service: 0, custom: 0, total: 0, invoices: 0 }
  );
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const isPositive = change > 0;
  const sign = change > 0 ? "+" : "";
  const colorClass = isPositive ? "text-green-600" : "text-red-600";
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {sign}{change.toFixed(0)}%
    </span>
  );
}

function RevenueSummary({
  data,
  previousYearData,
  periodLabel,
  orderDates,
}: {
  data: RollingMonth[];
  previousYearData?: RollingMonth[];
  periodLabel: string;
  orderDates: string[];
}) {
  const totals = calculateTotals(data);
  const previousTotals = previousYearData ? calculateTotals(previousYearData) : null;

  // --- Auftragsstatistik berechnen ---
  // Aufträge nach Jahr/Monat gruppieren
  const orderCounts = new Map<string, number>();
  for (const dateStr of orderDates) {
    if (!dateStr) continue;
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    orderCounts.set(key, (orderCounts.get(key) || 0) + 1);
  }

  // Aktuelle Periode
  let currentTotalOrders = 0;
  let currentTotalRevenue = 0;

  for (const item of data) {
    const key = `${item.year}-${String(item.month).padStart(2, "0")}`;
    const orders = orderCounts.get(key) || 0;
    const revenue = item.revenue_total;

    if (orders > 0 && revenue > 0) {
      currentTotalOrders += orders;
      currentTotalRevenue += revenue;
    }
  }

  const avgRevenuePerOrder = currentTotalOrders > 0 ? currentTotalRevenue / currentTotalOrders : 0;

  // Vorherige Periode
  let prevTotalOrders = 0;
  let prevTotalRevenue = 0;

  if (previousYearData) {
    for (const item of previousYearData) {
      const key = `${item.year}-${String(item.month).padStart(2, "0")}`;
      const orders = orderCounts.get(key) || 0;
      const revenue = item.revenue_total;

      if (orders > 0 && revenue > 0) {
        prevTotalOrders += orders;
        prevTotalRevenue += revenue;
      }
    }
  }

  const prevAvgRevenuePerOrder = prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0;

  const cards = [
    {
      title: "Gesamtumsatz",
      value: totals.total,
      display: formatMoney(totals.total),
      previous: previousTotals?.total || 0,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
      borderColor: "border-blue-100",
    },
    {
      title: "Handelsware",
      value: totals.handel,
      display: formatMoney(totals.handel),
      previous: previousTotals?.handel || 0,
      icon: Package,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      borderColor: "border-emerald-100",
    },
    {
      title: "Service",
      value: totals.service,
      display: formatMoney(totals.service),
      previous: previousTotals?.service || 0,
      icon: Wrench,
      color: "text-amber-600",
      bg: "bg-amber-50",
      borderColor: "border-amber-100",
    },
    {
      title: "Schärfumsatz / Auftrag",
      value: avgRevenuePerOrder,
      display: formatMoney(avgRevenuePerOrder),
      previous: 0,
      subText: currentTotalOrders > 0 ? `${currentTotalOrders} Aufträge` : "Keine Aufträge",
      icon: Calculator,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      borderColor: "border-indigo-100",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Umsatz {periodLabel}
        {previousYearData && previousYearData.length > 0 && (
          <span className="ml-2 text-xs">(Vergleich: Vorherige 12 Monate)</span>
        )}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className={`rounded-lg border ${card.borderColor} bg-card p-4 shadow-sm`}
          >
            <div className="flex items-start gap-3">
              <div className={`rounded-md p-2 ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground truncate">{card.title}</p>
                <p className="text-lg font-semibold truncate">{card.display}</p>
                {'subText' in card && card.subText && (
                  <p className="text-xs text-muted-foreground mt-0.5">{card.subText}</p>
                )}
                {card.previous > 0 && (
                  <div className="mt-1">
                    <ChangeIndicator current={card.value} previous={card.previous} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChart({ partnerId }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  // Rolling 12 Months
  const [currentPeriod, setCurrentPeriod] = useState<RollingMonth[]>([]);
  const [previousPeriod, setPreviousPeriod] = useState<RollingMonth[]>([]);
  const [hasPreviousPeriod, setHasPreviousPeriod] = useState(false);

  // Auftragsdaten
  const [orderDates, setOrderDates] = useState<string[]>([]);

  // Jahresdaten
  const [yearlyData, setYearlyData] = useState<YearlyRevenue[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // Rolling 12 Months + Aufträge laden
  useEffect(() => {
    async function loadRolling() {
      if (viewMode !== "month") return;
      setIsLoading(true);

      const [revenueResult, orderResult] = await Promise.all([
        getPartnerRollingRevenue(partnerId),
        getPartnerOrderDates(partnerId),
      ]);

      if (revenueResult.ok) {
        setCurrentPeriod(revenueResult.currentPeriod);
        setPreviousPeriod(revenueResult.previousPeriod);
        setHasPreviousPeriod(revenueResult.hasPreviousPeriod);
      }

      if (orderResult.ok) {
        setOrderDates(orderResult.dates);
      }

      setIsLoading(false);
    }
    loadRolling();
  }, [partnerId, viewMode]);

  // Jahresdaten laden
  useEffect(() => {
    async function loadYearly() {
      if (viewMode !== "year") return;
      setIsLoading(true);
      const result = await getPartnerYearlyRevenue(partnerId);
      if (result.ok) {
        setYearlyData(result.years);
      }
      setIsLoading(false);
    }
    loadYearly();
  }, [partnerId, viewMode]);

  const periodLabel = useMemo(() => {
    if (currentPeriod.length === 0) return "letzte 12 Monate";
    const first = currentPeriod[0];
    const last = currentPeriod[currentPeriod.length - 1];
    return `${first.label} – ${last.label}`;
  }, [currentPeriod]);

  const monthChartData = useMemo(() => {
    return currentPeriod.map((item, index) => {
      const prevItem = previousPeriod[index];
      return {
        name: item.label,
        Handelsware: Number(item.revenue_retail.toFixed(2)),
        Service: Number(item.revenue_service.toFixed(2)),
        Sonderwerkzeug: Number(item.revenue_custom.toFixed(2)),
        Gesamt: Number(item.revenue_total.toFixed(2)),
        "Vorherige 12M": prevItem ? Number(prevItem.revenue_total.toFixed(2)) : 0,
      };
    });
  }, [currentPeriod, previousPeriod]);

  const yearChartData = useMemo(() => {
    return yearlyData.map((item) => ({
      name: item.year.toString(),
      Gesamtumsatz: Number(item.revenue_total.toFixed(2)),
      Handelsware: Number(item.revenue_retail.toFixed(2)),
      Service: Number(item.revenue_service.toFixed(2)),
      Sonderwerkzeug: Number(item.revenue_custom.toFixed(2)),
    }));
  }, [yearlyData]);

  const hasMonthData = currentPeriod.some(
    (d) => d.revenue_retail > 0 || d.revenue_service > 0 || d.revenue_custom > 0
  );

  const hasYearData = yearlyData.length > 0;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="h-[120px] animate-pulse bg-muted rounded">
          <div className="grid grid-cols-4 gap-3 h-full p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted-foreground/10 rounded" />
            ))}
          </div>
        </div>
        <div className="h-[400px] animate-pulse bg-muted rounded">
          <div className="flex items-center justify-between mb-4 px-4 pt-4">
            <div className="h-6 w-32 bg-muted-foreground/20 rounded" />
            <div className="h-10 w-32 bg-muted-foreground/20 rounded" />
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI-Karten — immer sichtbar in Monatsansicht */}
      {viewMode === "month" && (
        <RevenueSummary
          data={currentPeriod}
          previousYearData={hasPreviousPeriod ? previousPeriod : undefined}
          periodLabel={periodLabel}
          orderDates={orderDates}
        />
      )}

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-lg border bg-card p-6 shadow-sm space-y-6"
      >
        {/* Header mit Periode-Info und Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg">
              {viewMode === "month" ? "Letzte 12 Monate" : "Jahresumsätze"}
            </h3>
            {viewMode === "month" && currentPeriod.length > 0 && (
              <p className="text-sm text-muted-foreground">{periodLabel}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Monat/Jahr */}
            <div className="flex rounded-lg border bg-muted p-1">
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
                className="text-xs"
              >
                12 Monate
              </Button>
              <Button
                variant={viewMode === "year" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("year")}
                className="text-xs"
              >
                Jahr
              </Button>
            </div>
          </div>
        </div>

        {/* Monatsansicht: Rolling 12 Months */}
        {viewMode === "month" && (
          <>
            {hasMonthData ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={monthChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(value: any) =>
                      value ? `€${(Number(value) / 1000).toFixed(0)}k` : "€0"
                    }
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `€${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
                      String(name),
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "1rem" }} />
                  <Area
                    type="monotone"
                    dataKey="Handelsware"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.85}
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Service"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.85}
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Sonderwerkzeug"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.85}
                    strokeWidth={1.5}
                  />
                  {hasPreviousPeriod && (
                    <Area
                      type="monotone"
                      dataKey="Vorherige 12M"
                      stroke="#9ca3af"
                      strokeDasharray="5 5"
                      fill="url(#colorPrev)"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Keine Umsatzdaten in den letzten 12 Monaten verfügbar
              </div>
            )}
          </>
        )}

        {/* Jahresansicht */}
        {viewMode === "year" && (
          <>
            {hasYearData ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={yearChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(value: any) =>
                      value ? `€${(Number(value) / 1000).toFixed(0)}k` : "€0"
                    }
                  />
                  <Tooltip
                    formatter={(value: any, name: any) => [
                      `€${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2 })}`,
                      String(name),
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "1rem" }} />
                  <Area
                    type="monotone"
                    dataKey="Handelsware"
                    stackId="1"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.85}
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Service"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.85}
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="Sonderwerkzeug"
                    stackId="1"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.85}
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Keine Jahresumsatzdaten verfügbar
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
