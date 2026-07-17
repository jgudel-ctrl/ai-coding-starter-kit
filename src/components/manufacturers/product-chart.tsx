"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

/* ═══════════════════════════════════════════
   Donut-Chart: Artikel vs Dienstleistungen
   ═══════════════════════════════════════════ */

const COLORS = {
  PRODUCT: "#3b82f6",
  SERVICE: "#f59e0b",
  UNKNOWN: "#9ca3af",
};

const LABELS: Record<string, string> = {
  PRODUCT: "📦 Artikel",
  SERVICE: "🔧 Dienstleistungen",
  UNKNOWN: "Unbekannt",
};

type ProductStatsByType = {
  type: string;
  count: number;
};

type ProductChartProps = {
  stats: ProductStatsByType[];
};

export function ProductChart({ stats }: ProductChartProps) {
  const chartData = stats.map((s) => ({
    name: LABELS[s.type] || s.type,
    value: s.count,
    color: COLORS[s.type as keyof typeof COLORS] || COLORS.UNKNOWN,
  }));

  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Verteilung</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full sm:w-48 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  dataKey="value"
                  nameKey="name"
                  label={({ percent }) =>
                    percent ? `${(percent * 100).toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, _name: any) => {
                    const num = Number(value);
                    return [
                      `${num} (${((num / total) * 100).toFixed(1)}%)`,
                      _name,
                    ];
                  }}
                  contentStyle={{ fontSize: "13px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            {chartData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
                <span className="font-medium ml-auto">{entry.value}</span>
              </div>
            ))}
            <div className="border-t pt-1 mt-1 text-muted-foreground text-xs">
              Gesamt: {total}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
