/**
 * InvoiceTable — Tabelle aller Rechnungen mit Pagination
 */
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "./payment-status-badge";
import { formatCent } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export interface InvoiceListItem {
  id: number;
  invoice_number: string;
  type: string;
  document_date: string;
  due_date: string | null;
  payment_status: string;
  paid_amount: number;
  amount: number;
  amount_net: number;
  currency: string;
  partner_name: string | null;
  partner_id: string | null;
  customer_id: number | null;
}

interface InvoiceTableProps {
  invoices: InvoiceListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const typeLabels: Record<string, string> = {
  INVOICE: "Rechnung",
  CREDIT: "Gutschrift",
  STORNO: "Storno",
  STORNO_CREDIT: "Storno-Gutschrift",
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("de-DE");
}

export function InvoiceTable({
  invoices,
  totalCount,
  page,
  pageSize,
  onPageChange,
}: InvoiceTableProps) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Keine Rechnungen gefunden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rechnungsnr.</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Typ</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Fällig</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Bezahlt</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/verwaltung/invoices/${invoice.id}`}
                    className="hover:underline text-primary"
                  >
                    {invoice.invoice_number}
                  </Link>
                </TableCell>
                <TableCell>
                  {invoice.partner_id ? (
                    <Link
                      href={`/kunden/${invoice.partner_id}`}
                      className="hover:underline text-primary"
                    >
                      {invoice.partner_name || `Partner ${invoice.customer_id}`}
                    </Link>
                  ) : invoice.partner_name ? (
                    <span className="text-muted-foreground">
                      {invoice.partner_name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      — (ID: {invoice.customer_id})
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {typeLabels[invoice.type] || invoice.type}
                  </span>
                </TableCell>
                <TableCell>{formatDate(invoice.document_date)}</TableCell>
                <TableCell>{formatDate(invoice.due_date)}</TableCell>
                <TableCell className="text-right">
                  {formatCent(invoice.amount_net)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCent(invoice.paid_amount)}
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={invoice.payment_status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Zeige {from}–{to} von {totalCount} Rechnungen
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm py-2">
            Seite {page} von {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
