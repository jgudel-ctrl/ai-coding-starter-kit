"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Wrench, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductCardMobile } from "./product-card-mobile";
import type {
  ProductWithManufacturer,
  Manufacturer,
  PositionGroup,
} from "@/lib/actions/manufacturers";

/* ═══════════════════════════════════════════
   Props
   ═══════════════════════════════════════════ */

type ProductTableProps = {
  products: ProductWithManufacturer[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  manufacturers: Manufacturer[];
  groups: PositionGroup[];
  selectedIds: string[];
  onSelectId: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onPageChange: (page: number) => void;
  onManufacturerChange: (productId: string, manufacturerId: string | null) => void;
  onBulkManufacturerChange: (manufacturerId: string | null) => void;
  onProductClick: (index: number) => void;
  filters: {
    manufacturerId?: string | null;
    groupId?: number | null;
    search?: string;
    type?: "PRODUCT" | "SERVICE" | "all";
  };
  onFilterChange: (filters: {
    manufacturerId?: string | null;
    groupId?: number | null;
    search?: string;
    type?: "PRODUCT" | "SERVICE" | "all";
  }) => void;
  isAdmin?: boolean;
};

/* ═══════════════════════════════════════════
   Component
   ═══════════════════════════════════════════ */

export function ProductTable({
  products,
  total,
  page,
  pageSize,
  loading,
  manufacturers,
  groups,
  selectedIds,
  onSelectId,
  onSelectAll,
  onPageChange,
  onManufacturerChange,
  onBulkManufacturerChange,
  onProductClick,
  filters,
  onFilterChange,
  isAdmin,
}: ProductTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const allSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id));

  // Native Select statt shadcn (Hydration-Probleme vermeiden)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Artikel suchen..."
            value={filters.search || ""}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="pl-9 w-full"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Hersteller-Filter (Native Select) */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">Hersteller</label>
            <select
              value={filters.manufacturerId ?? "all"}
              onChange={(e) => {
                const v = e.target.value;
                onFilterChange({
                  ...filters,
                  manufacturerId: v === "all" ? undefined : v === "none" ? null : v,
                });
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="all">Alle Hersteller</option>
              <option value="none">— Ohne Hersteller</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Rabattgruppen-Filter (Native Select) */}
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground mb-1 block">Rabattgruppe</label>
            <select
              value={
                filters.groupId === null
                  ? "none"
                  : filters.groupId ?? "all"
              }
              onChange={(e) => {
                const v = e.target.value;
                onFilterChange({
                  ...filters,
                  groupId:
                    v === "all" ? undefined : v === "none" ? null : parseInt(v),
                });
              }}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="all">Alle Gruppen</option>
              <option value="none">— Ohne Gruppe</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.number} — {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {total} Artikel {totalPages > 1 && `(Seite ${page} von ${totalPages})`}
        </div>
      </div>

      {/* Bulk Actions (Admin) */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} Artikel ausgewählt
          </span>
          <select
            onChange={(e) => {
              const v = e.target.value;
              onBulkManufacturerChange(v === "none" ? null : v);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            <option value="">Hersteller zuweisen...</option>
            <option value="none">Hersteller entfernen</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ════════════════════════
          MOBILE: Karten-Ansicht
          ════════════════════════ */}
      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            Keine Artikel gefunden.
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((p, idx) => (
              <ProductCardMobile
                key={p.id}
                product={p}
                onClick={() => onProductClick(idx)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════
          DESKTOP: Tabelle
          ════════════════════════ */}
      <div className="hidden md:block rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              {isAdmin && (
                <th className="w-10 px-4 py-3 text-left">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onSelectAll(!!checked)}
                    aria-label="Alle auswählen"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left font-medium">Nr.</th>
              <th className="px-4 py-3 text-left font-medium">Beschreibung</th>
              <th className="px-4 py-3 text-left font-medium">Typ</th>
              <th className="px-4 py-3 text-left font-medium">Gruppe</th>
              <th className="px-4 py-3 text-left font-medium">Hersteller</th>
              <th className="px-4 py-3 text-right font-medium">VK</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="h-12">
                  {isAdmin && <td className="px-4"><Skeleton className="h-4 w-4" /></td>}
                  <td className="px-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-16" /></td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Keine Artikel gefunden.
                </td>
              </tr>
            ) : (
              products.map((p, idx) => (
                <tr
                  key={p.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => onProductClick(idx)}
                >
                  {isAdmin && (
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={(checked) =>
                          onSelectId(p.id, !!checked)
                        }
                        aria-label={`Artikel ${p.number} auswählen`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs">{p.number}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={p.description}>
                    {p.description}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={p.type === "PRODUCT" ? "default" : "secondary"} className="text-xs">
                      {p.type === "PRODUCT" ? (
                        <>
                          <Package className="h-3 w-3 mr-1 inline" />
                          Artikel
                        </>
                      ) : (
                        <>
                          <Wrench className="h-3 w-3 mr-1 inline" />
                          Service
                        </>
                      )}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.group_number ? (
                      <span>{p.group_number} — {p.group_name}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <select
                        value={p.manufacturer_id ?? "none"}
                        onChange={(e) => {
                          e.stopPropagation();
                          onManufacturerChange(
                            p.id,
                            e.target.value === "none" ? null : e.target.value
                          );
                        }}
                        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs w-40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="none">— Ohne Hersteller</option>
                        {manufacturers.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    ) : p.manufacturer_name ? (
                      <Badge variant="secondary">
                        <Package className="h-3 w-3 mr-1" />
                        {p.manufacturer_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {p.sale_price !== null
                      ? `${p.sale_price.toFixed(2).replace(".", ",")} €`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
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
      )}
    </div>
  );
}
