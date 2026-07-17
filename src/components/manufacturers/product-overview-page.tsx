"use client";

import { useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import { ProductTable } from "@/components/manufacturers/product-table";
import { ProductChart } from "@/components/manufacturers/product-chart";
import { TypeToggle } from "@/components/manufacturers/type-toggle";
import { ProductDetailModal } from "@/components/manufacturers/product-detail-modal";
import {
  getProducts,
  updateProductManufacturer,
  bulkUpdateProductManufacturers,
  type ProductWithManufacturer,
  type Manufacturer,
  type PositionGroup,
  type ProductStatsByType,
} from "@/lib/actions/manufacturers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

/* ═══════════════════════════════════════════
   Artikel-Übersicht mit Mobile + Chart + Modal
   ═══════════════════════════════════════════ */

type ProductOverviewPageProps = {
  initialProducts: ProductWithManufacturer[];
  initialTotal: number;
  initialManufacturers: Manufacturer[];
  initialGroups: PositionGroup[];
  initialStats: ProductStatsByType[];
  isAdmin: boolean;
};

export function ProductOverviewPage({
  initialProducts,
  initialTotal,
  initialManufacturers,
  initialGroups,
  initialStats,
  isAdmin,
}: ProductOverviewPageProps) {
  const [products, setProducts] = useState(initialProducts);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState(initialStats);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    manufacturerId?: string | null;
    groupId?: number | null;
    search?: string;
    type?: "PRODUCT" | "SERVICE" | "all";
  }>({ type: "PRODUCT" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

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
    (newFilters: Partial<typeof filters>) => {
      const merged = { ...filters, ...newFilters };
      startTransition(() => {
        setFilters(merged);
        refresh(1, merged);
      });
    },
    [refresh, filters]
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

  // Modal Navigation
  const handleProductClick = (index: number) => {
    setModalIndex(index);
    setModalOpen(true);
  };

  const handleModalNavigate = (index: number) => {
    setModalIndex(index);
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            <CardTitle>Artikel-Verwaltung</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chart */}
          <ProductChart stats={stats} />

          {/* Typ-Toggle */}
          <TypeToggle
            value={filters.type || "PRODUCT"}
            onChange={(type) => handleFilterChange({ type })}
          />

          {/* Tabelle / Mobile-Karten */}
          <ProductTable
            products={products}
            total={total}
            page={page}
            pageSize={50}
            loading={isPending}
            manufacturers={initialManufacturers}
            groups={initialGroups}
            selectedIds={selectedIds}
            onSelectId={handleSelectId}
            onSelectAll={handleSelectAll}
            onPageChange={handlePageChange}
            onManufacturerChange={handleManufacturerChange}
            onBulkManufacturerChange={handleBulkManufacturerChange}
            filters={filters}
            onFilterChange={handleFilterChange}
            onProductClick={handleProductClick}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>

      {/* Detail-Modal */}
      <ProductDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        products={products}
        currentIndex={modalIndex}
        onNavigate={handleModalNavigate}
      />
    </div>
  );
}
