/**
 * Invoice Overview Page (Server-Komponente)
 * Zeigt alle Rechnungen mit Filter und Pagination.
 */

import { Suspense } from "react";
import { getInvoices } from "@/lib/actions/invoices";
import { InvoiceList } from "./components/invoice-list";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    type?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const paymentStatus = params.status || "";
  const docType = params.type || "";
  const search = params.search || "";

  // Rechnungen laden
  const result = await getInvoices({
    page,
    pageSize: 50,
    paymentStatus: paymentStatus || undefined,
    type: docType || undefined,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rechnungen</h1>
          <p className="text-muted-foreground">
            Übersicht aller Easybill-Rechnungen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/verwaltung/invoices/sync">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Link>
          </Button>
        </div>
      </div>

      {/* Inhalt */}
      <Suspense fallback={<div className="text-center py-12">Lade Rechnungen...⏳</div>}>
        <InvoiceList
          initialData={result.ok ? result.data : []}
          totalCount={result.ok ? result.totalCount : 0}
          currentPage={page}
          initialFilters={{
            paymentStatus,
            type: docType,
            search,
          }}
        />
      </Suspense>
    </div>
  );
}
