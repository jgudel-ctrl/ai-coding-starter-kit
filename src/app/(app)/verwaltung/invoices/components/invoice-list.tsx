/**
 * InvoiceList — Client-Komponente für interaktive Rechnungsübersicht
 * Verwendet Server Actions für Data Fetching (kein direkter DB-Zugriff)
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { InvoiceFilter, InvoiceFilters } from "./invoice-filter";
import { InvoiceTable } from "./invoice-table";
import { getInvoices, type InvoiceListItem } from "@/lib/actions/invoices";
import { Loader2 } from "lucide-react";

interface InvoiceListProps {
  initialData: InvoiceListItem[];
  totalCount: number;
  currentPage: number;
  initialFilters: InvoiceFilters;
}

export function InvoiceList({
  initialData,
  totalCount,
  currentPage,
  initialFilters,
}: InvoiceListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [invoices, setInvoices] = useState(initialData);
  const [total, setTotal] = useState(totalCount);
  const [page, setPage] = useState(currentPage);
  const [filters, setFilters] = useState<InvoiceFilters>(initialFilters);

  // Daten neu laden bei Filter-/Page-Änderung
  async function loadData(newPage: number, newFilters: InvoiceFilters) {
    startTransition(async () => {
      const result = await getInvoices({
        page: newPage,
        pageSize: 50,
        paymentStatus: newFilters.paymentStatus || undefined,
        type: newFilters.type || undefined,
        search: newFilters.search || undefined,
      });

      if (result.ok) {
        setInvoices(result.data);
        setTotal(result.totalCount);
        setPage(newPage);
        setFilters(newFilters);

        // URL aktualisieren
        const params = new URLSearchParams(searchParams);
        if (newPage > 1) params.set("page", String(newPage));
        else params.delete("page");
        if (newFilters.paymentStatus) params.set("status", newFilters.paymentStatus);
        else params.delete("status");
        if (newFilters.type) params.set("type", newFilters.type);
        else params.delete("type");
        if (newFilters.search) params.set("search", newFilters.search);
        else params.delete("search");

        router.push(`/verwaltung/invoices?${params.toString()}`, {
          scroll: false,
        });
      }
    });
  }

  function handleFilterChange(newFilters: InvoiceFilters) {
    loadData(1, newFilters);
  }

  function handlePageChange(newPage: number) {
    loadData(newPage, filters);
  }

  return (
    <div className="space-y-4">
      <InvoiceFilter filters={filters} onChange={handleFilterChange} />

      {isPending && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <InvoiceTable
        invoices={invoices}
        totalCount={total}
        page={page}
        pageSize={50}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
