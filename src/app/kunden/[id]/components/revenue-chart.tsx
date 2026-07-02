"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPartnerRevenue, getAvailableRevenueYears } from "@/lib/actions/revenue";

interface RevenueChartProps {
  partnerId: string;
}

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

export function RevenueChart({ partnerId }: RevenueChartProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState<number[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Verfügbare Jahre laden
  useEffect(() => {
    async function loadYears() {
      const result = await getAvailableRevenueYears(partnerId);
      if (result.ok && result.years.length > 0) {
        setYears(result.years);
        setSelectedYear(result.years[0]); // Neuestes Jahr
      } else {
        // Fallback: Aktuelles Jahr
        setYears([new Date().getFullYear()]);
      }
    }
    loadYears();
  }, [partnerId]);

  // Umsatz-Daten laden
  useEffect(() => {
    async function loadRevenue() {
      setIsLoading(true);
      const result = await getPartnerRevenue(partnerId, selectedYear);
      if (result.ok) {
        const chartData = result.data.map((item) => ({
          name: MONTHS[item.month - 1],
          Handelsware: Number(item.revenue_retail.toFixed(2)),
          Service: Number(item.revenue_service.toFixed(2)),
          Sonderwerkzeug: Number(item.revenue_custom.toFixed(2)),
          Gesamt: Number(item.revenue_total.toFixed(2)),
        }));
        setRevenueData(chartData);
      }
      setIsLoading(false);
    }
    if (selectedYear) {
      loadRevenue();
    }
  }, [partnerId, selectedYear]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-lg border bg-card p-6 shadow-sm"
      >
        <div className="h-[400px] animate-pulse bg-muted rounded">
          <div className="flex items-center justify-between mb-4 px-4 pt-4">
            <div className="h-6 w-32 bg-muted-foreground/20 rounded" />
            <div className="h-10 w-32 bg-muted-foreground/20 rounded" />
          </div>
          <div className="flex items-end justify-center h-[300px] gap-2 px-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="w-8 bg-muted-foreground/10 rounded-t"
                style={{ height: `${Math.random() * 100}%` }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  const hasData = revenueData.some(
    (d) => d.Handelsware > 0 || d.Service > 0 || d.Sonderwerkzeug > 0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg border bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h3 className="font-semibold text-lg">Monatsumsätze</h3>
        <Select
          value={selectedYear.toString()}
          onValueChange={(v) => setSelectedYear(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Jahr wählen" />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={revenueData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              tickFormatter={(value: any) =>
                value ? `€${(Number(value) / 1000).toFixed(0)}k` : '€0'
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
            <Legend
              wrapperStyle={{ paddingTop: "1rem" }}
            />
            <Bar
              dataKey="Handelsware"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="Service"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="Sonderwerkzeug"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          Keine Umsatzdaten für {selectedYear} verfügbar
        </div>
      )}
    </motion.div>
  );
}
