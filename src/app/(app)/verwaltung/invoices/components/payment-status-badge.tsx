/**
 * PaymentStatusBadge — Farbiger Status-Badge für Rechnungen
 */
"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  paid: { label: "Bezahlt", className: "bg-green-100 text-green-800 hover:bg-green-200" },
  partial: { label: "Teilweise", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200" },
  open: { label: "Offen", className: "bg-red-100 text-red-800 hover:bg-red-200" },
  overdue: { label: "Überfällig", className: "bg-red-100 text-red-800 hover:bg-red-200" },
};

export function PaymentStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || {
    label: status,
    variant: "outline" as const,
  };

  return <Badge className={config.className}>{config.label}</Badge>;
}
