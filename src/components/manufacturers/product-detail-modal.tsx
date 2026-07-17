"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Wrench, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProductWithManufacturer } from "@/lib/actions/manufacturers";

/* ═══════════════════════════════════════════
   Detail-Modal mit Swipe-Navigation
   ═══════════════════════════════════════════ */

type ProductDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  products: ProductWithManufacturer[];
  currentIndex: number;
  onNavigate: (index: number) => void;
};

export function ProductDetailModal({
  isOpen,
  onClose,
  products,
  currentIndex,
  onNavigate,
}: ProductDetailModalProps) {
  const [direction, setDirection] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const currentProduct = products[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < products.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) {
      setDirection(-1);
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) {
      setDirection(1);
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  // Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, goPrev, goNext, onClose]);

  // Touch Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;

    // Nur horizontaler Swipe (abs(dx) > abs(dy))
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) goPrev();
      else goNext();
    }

    setTouchStart(null);
  };

  if (!isOpen || !currentProduct) return null;

  const isProduct = currentProduct.type === "PRODUCT";

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header mit Navigation */}
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              disabled={!hasPrev}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {products.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              disabled={!hasNext}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Inhalt mit Animation */}
        <div className="p-4 min-h-[300px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentProduct.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {/* Artikelnummer + Typ */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">
                  {currentProduct.number}
                </span>
                <Badge variant={isProduct ? "default" : "secondary"}>
                  {isProduct ? (
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
              </div>

              {/* Beschreibung */}
              <h3 className="text-lg font-semibold mb-4">
                {currentProduct.description}
              </h3>

              {/* Details */}
              <div className="space-y-3 text-sm">
                <DetailRow label="Gruppe" value={currentProduct.group_name} />
                <DetailRow label="Gruppennummer" value={currentProduct.group_number} />
                <DetailRow label="Hersteller" value={currentProduct.manufacturer_name} />
                <DetailRow
                  label="Einkaufspreis"
                  value={
                    currentProduct.cost_price
                      ? `${currentProduct.cost_price.toFixed(2).replace(".", ",")} €`
                      : null
                  }
                />
                <DetailRow
                  label="Verkaufspreis"
                  value={
                    currentProduct.sale_price
                      ? `${currentProduct.sale_price.toFixed(2).replace(".", ",")} €`
                      : null
                  }
                />
                <DetailRow
                  label="MwSt"
                  value={
                    currentProduct.vat_percent
                      ? `${currentProduct.vat_percent}%`
                      : null
                  }
                />
                <DetailRow label="Einheit" value={currentProduct.unit} />
                <DetailRow
                  label="Status"
                  value={currentProduct.archived ? "Archiviert" : "Aktiv"}
                  valueClass={currentProduct.archived ? "text-orange-600" : "text-green-600"}
                />
                <DetailRow
                  label="Erstellt"
                  value={
                    currentProduct.created_at
                      ? new Date(currentProduct.created_at).toLocaleDateString("de-DE")
                      : null
                  }
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Navigation */}
        <div className="sticky bottom-0 bg-card border-t p-4 flex justify-between">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={!hasPrev}
            className="text-sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Vorheriger
          </Button>
          <Button
            variant="outline"
            onClick={goNext}
            disabled={!hasNext}
            className="text-sm"
          >
            Nächster <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | null;
  valueClass?: string;
}) {
  if (!value) return null;

  return (
    <div className="flex justify-between items-center border-b border-border/50 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass || "font-medium"}>{value}</span>
    </div>
  );
}
