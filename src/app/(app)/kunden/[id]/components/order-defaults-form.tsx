"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  upsertPartnerOrderDefault,
} from "@/lib/actions/order-defaults";
import {
  INBOUND_OPTIONS,
  OUTBOUND_OPTIONS,
  PICKUP_STATUS_OPTIONS,
  PICKUP_DAY_OPTIONS,
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
  const [pickupDay, setPickupDay] = useState(
    orderDefault?.pickup_day?.toString() || ""
  );
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Berechne ob Fahrer Pflicht ist
  const needsDriver =
    inboundType === "Abholservice durch Gudel Werkzeuge" ||
    outboundType === "Bringen";

  // Validierung
  const validate = () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      const result = await upsertPartnerOrderDefault(partnerId, {
        inbound_type: inboundType,
        outbound_type: outboundType,
        pickup_delivery_status: pickupStatus,
        driver_id: driverId || null,
        pickup_cycle_count: cycleCount ? parseInt(cycleCount, 10) : null,
        pickup_day: pickupDay ? parseInt(pickupDay, 10) : null,
      });

      setLoading(false);

      if (result.ok) {
        toast.success("Auftrags-Default gespeichert");
        onSuccess();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      setLoading(false);
      toast.error("Ein unerwarteter Fehler ist aufgetreten");
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Zugang */}
      <div className="space-y-1">
        <label htmlFor="inbound_type" className="text-sm font-medium">
          Zugang *</label>
        <select
          id="inbound_type"
          value={inboundType}
          onChange={(e) => setInboundType(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            errors.inbound_type ? "border-red-500" : "border-input"
          } bg-background`}
        >
          <option value="">Zugang wählen</option>
          {INBOUND_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {errors.inbound_type && (
          <p className="text-xs text-red-500">{errors.inbound_type}</p>
        )}
      </div>

      {/* Rücksendung */}
      <div className="space-y-1">
        <label htmlFor="outbound_type" className="text-sm font-medium">
          Rücksendung *</label>
        <select
          id="outbound_type"
          value={outboundType}
          onChange={(e) => setOutboundType(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            errors.outbound_type ? "border-red-500" : "border-input"
          } bg-background`}
        >
          <option value="">Rücksendung wählen</option>
          {OUTBOUND_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {errors.outbound_type && (
          <p className="text-xs text-red-500">{errors.outbound_type}</p>
        )}
      </div>

      {/* Fahrer — bedingt sichtbar */}
      {(needsDriver || driverId) && (
        <div className="space-y-1">
          <label htmlFor="driver_id" className="text-sm font-medium">
            Fahrer {needsDriver && "*"}
          </label>
          <select
            id="driver_id"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm ${
              errors.driver_id ? "border-red-500" : "border-input"
            } bg-background`}
          >
            <option value="">— Kein Fahrer —</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name}
              </option>
            ))}
          </select>
          {errors.driver_id && (
            <p className="text-xs text-red-500">{errors.driver_id}</p>
          )}
        </div>
      )}

      {/* Abholtag — nur bei Abholservice */}
      {inboundType === "Abholservice durch Gudel Werkzeuge" && (
        <div className="space-y-1">
          <label htmlFor="pickup_day" className="text-sm font-medium">
            Abholtag
          </label>
          <select
            id="pickup_day"
            value={pickupDay}
            onChange={(e) => setPickupDay(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
          >
            <option value="">— Kein Abholtag —</option>
            {PICKUP_DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Abholzyklus */}
      <div className="space-y-1">
        <label htmlFor="pickup_cycle_count" className="text-sm font-medium">
          Abholzyklus (Wochen)</label>
        <input
          id="pickup_cycle_count"
          type="number"
          min={1}
          max={52}
          placeholder="z.B. 1 = jede Woche"
          value={cycleCount}
          onChange={(e) => setCycleCount(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            errors.pickup_cycle_count ? "border-red-500" : "border-input"
          } bg-background`}
        />
        {errors.pickup_cycle_count && (
          <p className="text-xs text-red-500">{errors.pickup_cycle_count}</p>
        )}
      </div>

      {/* Abholstatus */}
      <div className="space-y-1">
        <label htmlFor="pickup_delivery_status" className="text-sm font-medium">
          Abholstatus *</label>
        <select
          id="pickup_delivery_status"
          value={pickupStatus}
          onChange={(e) => setPickupStatus(e.target.value)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            errors.pickup_delivery_status ? "border-red-500" : "border-input"
          } bg-background`}
        >
          <option value="">Abholstatus wählen</option>
          {PICKUP_STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {errors.pickup_delivery_status && (
          <p className="text-xs text-red-500">{errors.pickup_delivery_status}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 pt-4">
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
