"use client";

import { motion } from "framer-motion";
import { TrendingUp, Receipt, Package } from "lucide-react";

interface RevenueSummaryProps {
  data: {
    revenue_retail: number;
    revenue_service: number;
    revenue_custom: number;
    revenue_total: number;
    invoice_count: number;
  }[];
}

export function RevenueSummary({ data }: RevenueSummaryProps) {
  const totals = data.reduce(
    (acc, item) => ({
      handel: acc.handel + item.revenue_retail,
      service: acc.service + item.revenue_service,
      custom: acc.custom + item.revenue_custom,
      total: acc.total + item.revenue_total,
      invoices: acc.invoices + item.invoice_count,
    }),
    { handel: 0, service: 0, custom: 0, total: 0, invoices: 0 }
  );

  const cards = [
    {
      title: "Gesamtumsatz",
      value: `€${totals.total.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Handelsware",
      value: `€${totals.handel.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Package,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Service",
      value: `€${totals.service.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Receipt,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      title: "Rechnungen",
      value: totals.invoices.toString(),
      icon: Receipt,
      color: "text-slate-600",
      bg: "bg-slate-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="rounded-lg border bg-card p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-md p-2 ${card.bg}`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <p className="text-lg font-semibold">{card.value}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
