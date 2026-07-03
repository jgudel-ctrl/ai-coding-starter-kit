"use client";

import { motion } from "framer-motion";
import { TrendingUp, Wrench, Package, ReceiptText, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { MonthlyRevenue } from "@/lib/actions/revenue";

interface RevenueSummaryProps {
  data: MonthlyRevenue[];
  previousYearData?: MonthlyRevenue[];
  selectedYear: number;
}

function calculateTotals(data: MonthlyRevenue[]) {
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

function formatMoney(value: number): string {
  return `€${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export function RevenueSummary({ data, previousYearData, selectedYear }: RevenueSummaryProps) {
  const totals = calculateTotals(data);
  const previousTotals = previousYearData ? calculateTotals(previousYearData) : null;

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
      title: "Rechnungen",
      value: totals.invoices,
      display: totals.invoices.toString(),
      previous: previousTotals?.invoices || 0,
      icon: ReceiptText,
      color: "text-slate-600",
      bg: "bg-slate-50",
      borderColor: "border-slate-100",
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Umsatz für {selectedYear}
        {previousYearData && (
          <span className="ml-2 text-xs">(Vergleich mit {selectedYear - 1})</span>
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
