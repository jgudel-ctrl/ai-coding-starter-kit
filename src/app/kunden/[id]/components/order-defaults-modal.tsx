"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderDefaultsForm } from "./order-defaults-form";
import type { OrderDefault, DriverOption } from "@/lib/actions/order-defaults";

interface OrderDefaultsModalProps {
  partnerId: string;
  orderDefault: OrderDefault | null;
  drivers: DriverOption[];
  onClose: () => void;
}

export function OrderDefaultsModal({
  partnerId,
  orderDefault,
  drivers,
  onClose,
}: OrderDefaultsModalProps) {
  // Nur auf Client rendern (Portal braucht document)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Auftrags-Default bearbeiten
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <OrderDefaultsForm
          partnerId={partnerId}
          orderDefault={orderDefault}
          drivers={drivers}
          onSuccess={onClose}
        />
      </div>
    </div>,
    document.body
  );
}
