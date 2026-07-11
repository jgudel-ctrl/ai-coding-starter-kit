"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  ProductWithManufacturer,
  Manufacturer,
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
  selectedIds: string[];
  onSelectId: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onPageChange: (page: number) => void;
  onManufacturerChange: (productId: string, manufacturerId: string | null) => void;
  onBulkManufacturerChange: (manufacturerId: string | null) => void;
  filters: {
    manufacturerId?: string | null;
    search?: string;
  };
  onFilterChange: (filters: { manufacturerId?: string | null; search?: string }) => void;
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
  selectedIds,
  onSelectId,
  onSelectAll,
  onPageChange,
  onManufacturerChange,
  onBulkManufacturerChange,
  filters,
  onFilterChange,
  isAdmin,
}: ProductTableProps) {
  const totalPages = Math.ceil(total / pageSize);
  const allSelected = products.length > 0 && products.every((p) => selectedIds.includes(p.id));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Artikel suchen..."
              value={filters.search || ""}
              onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
              className="pl-9 w-full sm:w-64"
            />
          </div>

          <Select
            value={filters.manufacturerId ?? "all"}
            onValueChange={(v) =>
              onFilterChange({
                ...filters,
                manufacturerId: v === "all" ? undefined : v === "none" ? null : v,
              })
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Hersteller filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Hersteller</SelectItem>
              <SelectItem value="none"><span className="text-muted-foreground">— Ohne Hersteller</span></SelectItem>
              {manufacturers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-muted-foreground">
          {total} Artikel {totalPages > 1 && `(Seite ${page} von ${totalPages})`}
        </div>
      </div>

      {/* Bulk Actions */}
      {isAdmin && selectedIds.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2">
          <span className="text-sm text-muted-foreground">
            {selectedIds.length} Artikel ausgewählt
          </span>
          <Select
            onValueChange={(v) => onBulkManufacturerChange(v === "none" ? null : v)}
          >
            <SelectTrigger className="w-48 text-sm">
              <SelectValue placeholder="Hersteller zuweisen..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none"><span className="text-destructive">Hersteller entfernen</span></SelectItem>
              {manufacturers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
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
              <th className="px-4 py-3 text-left font-medium">Artikelnummer</th>
              <th className="px-4 py-3 text-left font-medium">Beschreibung</th>
              <th className="px-4 py-3 text-left font-medium">Hersteller</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="h-12">
                  {isAdmin && (
                    <td className="px-4"><Skeleton className="h-4 w-4" /></td>
                  )}
                  <td className="px-4"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4"><Skeleton className="h-4 w-16" /></td>
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 4 : 3}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Keine Artikel gefunden.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/50">
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.includes(p.id)}
                        onCheckedChange={(checked) => onSelectId(p.id, !!checked)}
                        aria-label={`Artikel ${p.number} auswählen`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-xs">{p.number}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={p.description}>
                    {p.description}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin ? (
                      <Select
                        value={p.manufacturer_id ?? "none"}
                        onValueChange={(v) =>
                          onManufacturerChange(p.id, v === "none" ? null : v)
                        }
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">— Ohne Hersteller</span>
                          </SelectItem>
                          {manufacturers.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : p.manufacturer_name ? (
                      <Badge variant="secondary">
                        <Package className="h-3 w-3 mr-1" />
                        {p.manufacturer_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
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
