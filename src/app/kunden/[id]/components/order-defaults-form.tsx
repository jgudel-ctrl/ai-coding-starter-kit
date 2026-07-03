"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  upsertPartnerOrderDefault,
} from "@/lib/actions/order-defaults";
import {
  INBOUND_OPTIONS,
  OUTBOUND_OPTIONS,
  PICKUP_STATUS_OPTIONS,
} from "@/lib/actions/order-defaults-shared";
import type { OrderDefault, DriverOption } from "@/lib/actions/order-defaults";

interface OrderDefaultsFormProps {
  partnerId: string;
  orderDefault: OrderDefault | null;
  drivers: DriverOption[];
  onSuccess: () => void;
}

export function OrderDefaultsForm({
  partnerId,
  orderDefault,
  drivers,
  onSuccess,
}: OrderDefaultsFormProps) {
  const [inboundType, setInboundType] = useState(orderDefault?.inbound_type || "");
  const [outboundType, setOutboundType] = useState(orderDefault?.outbound_type || "");
  const [pickupStatus, setPickupStatus] = useState(orderDefault?.pickup_delivery_status || "");
  const [driverId, setDriverId] = useState(orderDefault?.driver_id || "");
  const [cycleCount, setCycleCount] = useState(
    orderDefault?.pickup_cycle_count?.toString() || ""
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Berechne ob Fahrer Pflicht ist
  const needsDriver =
    inboundType === "Abholservice durch Gudel Werkzeuge" ||
    outboundType === "Bringen";

  // Validierung
  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!inboundType) newErrors.inbound_type = "Zugang ist erforderlich";
    if (!outboundType) newErrors.outbound_type = "Rücksendung ist erforderlich";
    if (!pickupStatus) newErrors.pickup_delivery_status = "Abholstatus ist erforderlich";

    if (needsDriver && !driverId) {
      newErrors.driver_id = "Fahrer ist bei Abholservice oder 'Bringen' erforderlich";
    }

    if (cycleCount) {
      const num = parseInt(cycleCount, 10);
      if (isNaN(num) || num < 1) {
        newErrors.pickup_cycle_count = "Abholzyklus muss mindestens 1 Woche sein";
      } else if (num > 52) {
        newErrors.pickup_cycle_count = "Abholzyklus darf nicht mehr als 52 Wochen sein";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [inboundType, outboundType, pickupStatus, needsDriver, driverId, cycleCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    const result = await upsertPartnerOrderDefault(partnerId, {
      inbound_type: inboundType,
      outbound_type: outboundType,
      pickup_delivery_status: pickupStatus,
      driver_id: driverId || null,
      pickup_cycle_count: cycleCount ? parseInt(cycleCount, 10) : null,
    });

    setLoading(false);

    if (result.ok) {
      toast.success("Auftrags-Default gespeichert");
      onSuccess();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Zugang */}
      <div className="space-y-1.5">
        <Label htmlFor="inbound_type">Zugang *</Label>
        <Select
          value={inboundType}
          onValueChange={setInboundType}
        >
          <SelectTrigger id="inbound_type" className={errors.inbound_type ? "border-red-500" : ""}>
            <SelectValue placeholder="Zugang wählen" />
          </SelectTrigger>
          <SelectContent>
            {INBOUND_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.inbound_type && (
          <p className="text-xs text-red-500">{errors.inbound_type}</p>
        )}
      </div>

      {/* Rücksendung */}
      <div className="space-y-1.5">
        <Label htmlFor="outbound_type">Rücksendung *</Label>
        <Select
          value={outboundType}
          onValueChange={setOutboundType}
        >
          <SelectTrigger id="outbound_type" className={errors.outbound_type ? "border-red-500" : ""}>
            <SelectValue placeholder="Rücksendung wählen" />
          </SelectTrigger>
          <SelectContent>
            {OUTBOUND_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.outbound_type && (
          <p className="text-xs text-red-500">{errors.outbound_type}</p>
        )}
      </div>

      {/* Fahrer — bedingt sichtbar */}
      {(needsDriver || driverId) && (
        <div className="space-y-1.5">
          <Label htmlFor="driver_id">
            Fahrer {needsDriver && "*"}
          </Label>
          <Select
            value={driverId}
            onValueChange={setDriverId}
          >
            <SelectTrigger
              id="driver_id"
              className={errors.driver_id ? "border-red-500" : ""}
            >
              <SelectValue placeholder="Fahrer wählen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Kein Fahrer —</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.driver_id && (
            <p className="text-xs text-red-500">{errors.driver_id}</p>
          )}
        </div>
      )}

      {/* Abholzyklus */}
      <div className="space-y-1.5">
        <Label htmlFor="pickup_cycle_count">Abholzyklus (Wochen)</Label>
        <Input
          id="pickup_cycle_count"
          type="number"
          min={1}
          max={52}
          placeholder="z.B. 1 = jede Woche"
          value={cycleCount}
          onChange={(e) => setCycleCount(e.target.value)}
          className={errors.pickup_cycle_count ? "border-red-500" : ""}
        />
        {errors.pickup_cycle_count && (
          <p className="text-xs text-red-500">{errors.pickup_cycle_count}</p>
        )}
      </div>

      {/* Abholstatus */}
      <div className="space-y-1.5">
        <Label htmlFor="pickup_delivery_status">Abholstatus *</Label>
        <Select
          value={pickupStatus}
          onValueChange={setPickupStatus}
        >
          <SelectTrigger
            id="pickup_delivery_status"
            className={errors.pickup_delivery_status ? "border-red-500" : ""}
          >
            <SelectValue placeholder="Abholstatus wählen" />
          </SelectTrigger>
          <SelectContent>
            {PICKUP_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.pickup_delivery_status && (
          <p className="text-xs text-red-500">{errors.pickup_delivery_status}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Speichern…" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}
