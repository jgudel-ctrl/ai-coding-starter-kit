"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addBlockedPeriod, removeBlockedPeriod } from "@/lib/actions/blocked-days";
import type { BlockedPeriod } from "@/lib/actions/blocked-days";

interface BlockedDaysClientProps {
  initialPeriods: BlockedPeriod[];
}

export function BlockedDaysClient({ initialPeriods }: BlockedDaysClientProps) {
  const [periods, setPeriods] = useState<BlockedPeriod[]>(initialPeriods);
  const [vonDatum, setVonDatum] = useState("");
  const [bisDatum, setBisDatum] = useState("");
  const [grund, setGrund] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vonDatum || !bisDatum || !grund) {
      toast.error("Bitte alle Felder ausfüllen");
      return;
    }

    setLoading(true);
    const result = await addBlockedPeriod(vonDatum, bisDatum, grund);
    setLoading(false);

    if (result.ok) {
      toast.success("Blocker hinzugefügt");
      // Aktualisiere die Liste
      const updated = await fetch("/api/blocked-days").then((r) => r.json());
      setPeriods(updated.data || periods);
      setVonDatum("");
      setBisDatum("");
      setGrund("");
    } else {
      toast.error(result.error);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await removeBlockedPeriod(id);
    if (result.ok) {
      toast.success("Blocker gelöscht");
      setPeriods(periods.filter((p) => p.id !== id));
    } else {
      toast.error(result.error);
    }
  };

  // Gruppiere nach Typ
  const feiertage = periods.filter((p) => p.typ === "feiertag");
  const manuelle = periods.filter((p) => p.typ === "manuell");

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Formular: Neuer Blocker */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-1.5">
          <Plus className="h-4 w-4" />
          Zeitraum blockieren
        </h3>
        <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-4 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Von</label>
            <input
              type="date"
              value={vonDatum}
              onChange={(e) => setVonDatum(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Bis</label>
            <input
              type="date"
              value={bisDatum}
              onChange={(e) => setBisDatum(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Grund</label>
            <input
              type="text"
              placeholder="z.B. Betriebsferien"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Hinzufügen…" : "Hinzufügen"}
          </Button>
        </form>
      </div>

      {/* Liste: Feiertage */}
      {feiertage.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            Feiertage NRW (automatisch)
          </h3>
          <div className="space-y-2">
            {feiertage.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm"
              >
                <span>
                  {formatDate(period.von_datum)}
                  {period.von_datum !== period.bis_datum &&
                    ` – ${formatDate(period.bis_datum)}`}
                  {" "}
                  <span className="text-muted-foreground">{period.grund}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(period.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste: Manuelle Blocker */}
      {manuelle.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-orange-500" />
            Manuelle Blocker
          </h3>
          <div className="space-y-2">
            {manuelle.map((period) => (
              <div
                key={period.id}
                className="flex items-center justify-between rounded-md bg-orange-50 px-3 py-2 text-sm"
              >
                <span>
                  {formatDate(period.von_datum)}
                  {period.von_datum !== period.bis_datum &&
                    ` – ${formatDate(period.bis_datum)}`}
                  {" "}
                  <span className="text-muted-foreground">{period.grund}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(period.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {periods.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Keine Blocker eingetragen. Feiertage werden automatisch geladen.
        </div>
      )}
    </div>
  );
}
