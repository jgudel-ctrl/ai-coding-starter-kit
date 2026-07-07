"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { TradeOrderItem } from "@/lib/actions/orders";

interface OrderDetailModalProps {
  order: TradeOrderItem | null;
  orders: TradeOrderItem[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function OrderDetailModal({
  order,
  orders,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: OrderDetailModalProps) {
  const [direction, setDirection] = useState(0);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0.3, 1, 0.3]);
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);
  const swipeRef = useRef<HTMLDivElement>(null);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "—";
    return `€${value.toLocaleString("de-DE", { minimumFractionDigits: 2 })}`;
  };

  const navigate = useCallback(
    (dir: number) => {
      const newIndex = currentIndex + dir;
      if (newIndex >= 0 && newIndex < orders.length) {
        setDirection(dir);
        onNavigate(newIndex);
      }
    },
    [currentIndex, orders.length, onNavigate]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, navigate, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    const swipeThreshold = 100;
    if (info.offset.x < -swipeThreshold) {
      navigate(1);
    } else if (info.offset.x > swipeThreshold) {
      navigate(-1);
    }
  };

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

  if (!isOpen || !order) return null;

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < orders.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-card rounded-2xl border shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="text-sm text-muted-foreground">
                {currentIndex + 1} / {orders.length}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Swipeable content area */}
            <motion.div
              ref={swipeRef}
              style={{ x, opacity, scale }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="p-5 cursor-grab active:cursor-grabbing"
            >
              <div className="space-y-4">
                {/* Beschreibung */}
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Artikel
                  </p>
                  <p className="text-lg font-semibold leading-snug">{order.description}</p>
                </div>

                {/* Rechnung + Datum */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Rechnung</p>
                    <p className="font-mono text-sm">{order.document_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Datum</p>
                    <p className="text-sm">{formatDate(order.document_date)}</p>
                  </div>
                </div>

                {/* Artikelnummer */}
                {order.article_number && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Artikelnummer</p>
                    <p className="font-mono text-sm">{order.article_number}</p>
                  </div>
                )}

                {/* Menge + Preis */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Menge</p>
                    <p className="text-lg font-semibold">{order.quantity}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Rabatt</p>
                    <p className="text-lg font-semibold">
                      {order.discount_percent ? `${order.discount_percent}%` : "—"}
                    </p>
                  </div>
                </div>

                {/* Preise */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Einzelpreis (netto)</span>
                    <span className="font-mono text-sm">{formatCurrency(order.unit_price_net)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gesamt (netto)</span>
                    <span className="font-mono text-sm font-semibold">{formatCurrency(order.total_net)}</span>
                  </div>
                  {order.purchase_price !== null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">EK-Preis</span>
                      <span className="font-mono text-sm">{formatCurrency(order.purchase_price)}</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Swipe hint */}
            <p className="text-center text-xs text-muted-foreground pb-3 px-4">
              Nach links/rechts wischen für nächsten/vorherigen Artikel
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex justify-center gap-4 mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(-1)}
            disabled={!canGoPrev}
            className="rounded-full px-4"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Vorheriger
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(1)}
            disabled={!canGoNext}
            className="rounded-full px-4"
          >
            Nächster
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
