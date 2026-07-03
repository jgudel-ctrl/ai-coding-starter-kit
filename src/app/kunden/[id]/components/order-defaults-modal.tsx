"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Auftrags-Default bearbeiten</DialogTitle>
        </DialogHeader>

        <OrderDefaultsForm
          partnerId={partnerId}
          orderDefault={orderDefault}
          drivers={drivers}
          onSuccess={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
