"use client";

import { useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { ProductTable } from "@/components/manufacturers/product-table";
import {
  getProducts,
  updateProductManufacturer,
  bulkUpdateProductManufacturers,
  type ProductWithManufacturer,
  type Manufacturer,
} from "@/lib/actions/manufacturers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

/* ═══════════════════════════════════════════
   Artikel-Übersicht mit Hersteller
   ═══════════════════════════════════════════ */

type ProductOverviewPageProps = {
  initialProducts: ProductWithManufacturer[];
  initialTotal: number;
  initialManufacturers: Manufacturer[];
  isAdmin: boolean;
};

export function ProductOverviewPage({
  initialProducts,
  initialTotal,
  initialManufacturers,
  isAdmin,
}: ProductOverviewPageProps) {
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    manufacturerId?: string | null;
    search?: string;
  }>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(
    async (newPage?: number, newFilters?: typeof filters) => {
      const p = newPage ?? page;
      const f = newFilters ?? filters;

      const result = await getProducts({
        ...f,
        page: p,
        pageSize: 50,
      });

      if (result.ok) {
        setProducts(result.data);
        setTotal(result.total);
        setPage(p);
        setFilters(f);
        setSelectedIds([]);
      } else {
        toast.error(result.error);
      }
    },
    [page, filters]
  );

  const handleFilterChange = useCallback(
    (newFilters: typeof filters) => {
      startTransition(() => {
        setFilters(newFilters);
        refresh(1, newFilters);
      });
    },
    [refresh]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      startTransition(() => {
        refresh(newPage, filters);
      });
    },
    [refresh, filters]
  );

  const handleSelectId = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((sid) => sid !== id)
    );
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? products.map((p) => p.id) : []);
    },
    [products]
  );

  const handleManufacturerChange = async (
    productId: string,
    manufacturerId: string | null
  ) => {
    const result = await updateProductManufacturer(productId, manufacturerId);
    if (result.ok) {
      toast.success("Hersteller zugewiesen.");
      await refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleBulkManufacturerChange = async (
    manufacturerId: string | null
  ) => {
    if (selectedIds.length === 0) return;

    const result = await bulkUpdateProductManufacturers(
      selectedIds,
      manufacturerId
    );
    if (result.ok) {
      toast.success(`${result.updated} Artikel zugewiesen.`);
      await refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <CardTitle>Artikel-Übersicht</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ProductTable
            products={products}
            total={total}
            page={page}
            pageSize={50}
            loading={isPending}
            manufacturers={initialManufacturers}
            selectedIds={selectedIds}
            onSelectId={handleSelectId}
            onSelectAll={handleSelectAll}
            onPageChange={handlePageChange}
            onManufacturerChange={handleManufacturerChange}
            onBulkManufacturerChange={handleBulkManufacturerChange}
            filters={filters}
            onFilterChange={handleFilterChange}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>
    </div>
  );
}
