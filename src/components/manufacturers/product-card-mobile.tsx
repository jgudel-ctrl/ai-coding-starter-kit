"use client";

import { Badge } from "@/components/ui/badge";
import { Package, Wrench } from "lucide-react";
import type { ProductWithManufacturer } from "@/lib/actions/manufacturers";

/* ═══════════════════════════════════════════
   Mobile Artikel-Karte (unter 768px)
   ═══════════════════════════════════════════ */

type ProductCardMobileProps = {
  product: ProductWithManufacturer;
  onClick: () => void;
};

export function ProductCardMobile({ product, onClick }: ProductCardMobileProps) {
  const isProduct = product.type === "PRODUCT";

  return (
    <div
      onClick={onClick}
      className="border rounded-lg p-4 shadow-sm bg-card cursor-pointer hover:bg-muted/50 transition-colors active:scale-[0.99]"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-mono text-muted-foreground">
          {product.number}
        </span>
        <Badge variant={isProduct ? "default" : "secondary"} className="text-xs">
          {isProduct ? (
            <Package className="h-3 w-3 mr-1" />
          ) : (
            <Wrench className="h-3 w-3 mr-1" />
          )}
          {isProduct ? "Artikel" : "Service"}
        </Badge>
      </div>

      <p className="text-sm font-medium mb-2 line-clamp-2">
        {product.description}
      </p>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {product.group_number && (
          <span className="bg-muted px-2 py-0.5 rounded">
            {product.group_number}
          </span>
        )}
        {product.manufacturer_name && (
          <span className="bg-muted px-2 py-0.5 rounded">
            {product.manufacturer_name}
          </span>
        )}
      </div>

      {product.sale_price !== null && (
        <div className="mt-2 text-sm font-medium">
          {product.sale_price.toFixed(2).replace(".", ",")} €
        </div>
      )}

      {product.archived && (
        <Badge variant="outline" className="mt-2 text-xs text-muted-foreground">
          Archiviert
        </Badge>
      )}
    </div>
  );
}
