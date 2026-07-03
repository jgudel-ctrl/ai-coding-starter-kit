"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(true);

  const handleClose = () => {
    setOpen(false);
    // Kurze Verzögerung für Exit-Animation
    setTimeout(onClose, 150);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auftrags-Default bearbeiten</DialogTitle>
        </DialogHeader>

        <OrderDefaultsForm
          partnerId={partnerId}
          orderDefault={orderDefault}
          drivers={drivers}
          onSuccess={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
}
