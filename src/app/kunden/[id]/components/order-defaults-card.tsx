"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderDefaultsModal } from "./order-defaults-modal";
import type { OrderDefault, DriverOption } from "@/lib/actions/order-defaults";

interface OrderDefaultsCardProps {
  orderDefault: OrderDefault | null;
  drivers: DriverOption[];
  isAdmin: boolean;
  partnerId: string;
}

export function OrderDefaultsCard({
  orderDefault,
  drivers,
  isAdmin,
  partnerId,
}: OrderDefaultsCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  // Fahrer-Name finden
  const driverName = orderDefault?.driver_id
    ? drivers.find((d) => d.id === orderDefault.driver_id)?.full_name || "—"
    : "—";

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">📋 Auftrags-Default</h3>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsEditing(true)}
            title="Bearbeiten"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3 text-sm">
        {/* Zugang */}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground shrink-0">Zugang</span>
          <span className="text-right">
            {orderDefault?.inbound_type || "—"}
          </span>
        </div>

        {/* Rücksendung */}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground shrink-0">Rücksendung</span>
          <span className="text-right">
            {orderDefault?.outbound_type || "—"}
          </span>
        </div>

        {/* Fahrer — nur anzeigen wenn sinnvoll */}
        {(orderDefault?.driver_id ||
          orderDefault?.inbound_type === "Abholservice durch Gudel Werkzeuge" ||
          orderDefault?.outbound_type === "Bringen") && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Fahrer</span>
            <span className="text-right">{driverName}</span>
          </div>
        )}

        {/* Abholzyklus */}
        {orderDefault?.pickup_cycle_count && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground shrink-0">Abholzyklus</span>
            <span className="text-right">
              Alle {orderDefault.pickup_cycle_count} Woche
              {orderDefault.pickup_cycle_count > 1 ? "n" : ""}
            </span>
          </div>
        )}

        {/* Abholstatus */}
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground shrink-0">Abholstatus</span>
          <span className="text-right">
            {orderDefault?.pickup_delivery_status || "—"}
          </span>
        </div>
      </div>

      {/* Modal */}
      {isEditing && (
        <OrderDefaultsModal
          partnerId={partnerId}
          orderDefault={orderDefault}
          drivers={drivers}
          onClose={() => setIsEditing(false)}
        />
      )}
    </div>
  );
}
