"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPickupTour, calculateNextPickupDate } from "@/lib/actions/pickup-tours";
import type { DriverOption } from "@/lib/actions/order-defaults";

interface CreatePickupModalProps {
  partnerId: string;
  drivers: DriverOption[];
  onClose: () => void;
}

export function CreatePickupModal({
  partnerId,
  drivers,
  onClose,
}: CreatePickupModalProps) {
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Berechne Default-Datum beim Öffnen
  useEffect(() => {
    async function loadDefaultDate() {
      const result = await calculateNextPickupDate(partnerId);
      if (result.ok) {
        setSelectedDate(result.date);
      } else {
        // Fallback: Heute + 1 Woche
        const fallback = new Date();
        fallback.setDate(fallback.getDate() + 7);
        setSelectedDate(fallback.toISOString().split("T")[0]);
      }
      setLoading(false);
    }
    loadDefaultDate();
  }, [partnerId]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!selectedDate) newErrors.date = "Datum ist erforderlich";
    if (!selectedDriver) newErrors.driver = "Fahrer ist erforderlich";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const result = await createPickupTour(partnerId, {
        geplantes_abholdatum: selectedDate,
        fahrer_id: selectedDriver || null,
        titel: note || null,
      });

      if (result.ok) {
        toast.success("Abholung erstellt");
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error("Ein Fehler ist aufgetreten");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Neue Abholung erstellen</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datum */}
          <div className="space-y-1">
            <label htmlFor="date" className="text-sm font-medium">
              Geplantes Abholdatum *
            </label>
            <input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={loading}
              className={`w-full rounded-md border px-3 py-2 text-sm ${
                errors.date ? "border-red-500" : "border-input"
              } bg-background`}
            />
            {errors.date && (
              <p className="text-xs text-red-500">{errors.date}</p>
            )}
            {loading && (
              <p className="text-xs text-muted-foreground">
                Berechne optimales Datum…
              </p>
            )}
          </div>

          {/* Fahrer */}
          <div className="space-y-1">
            <label htmlFor="driver" className="text-sm font-medium">
              Fahrer *
            </label>
            <select
              id="driver"
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 text-sm ${
                errors.driver ? "border-red-500" : "border-input"
              } bg-background`}
            >
              <option value="">— Fahrer wählen —</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
            {errors.driver && (
              <p className="text-xs text-red-500">{errors.driver}</p>
            )}
          </div>

          {/* Notiz */}
          <div className="space-y-1">
            <label htmlFor="note" className="text-sm font-medium">
              Titel / Notiz (optional)
            </label>
            <input
              id="note"
              type="text"
              placeholder="z.B. Regelmäßige Abholung"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || loading}>
              {saving ? "Erstellen…" : "Abholung erstellen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
