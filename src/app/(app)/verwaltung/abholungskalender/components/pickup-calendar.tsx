"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addBlockedPeriod, removeBlockedPeriod } from "@/lib/actions/blocked-days";
import type { BlockedPeriod } from "@/lib/actions/blocked-days";

type Ansicht = "monat" | "woche" | "jahr";

interface BlockedPeriodWithDates extends BlockedPeriod {
  vonDate: Date;
  bisDate: Date;
}

interface PickupCalendarProps {
  periods: BlockedPeriod[];
}

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONATS_NAMEN = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/* ───────────────────────── Hilfsfunktionen ─────────────────────────── */

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isBlocked(date: Date, periods: BlockedPeriodWithDates[]): { typ: string; grund: string } | null {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  for (const p of periods) {
    if (d >= p.vonDate && d <= p.bisDate) {
      return { typ: p.typ, grund: p.grund };
    }
  }
  return null;
}

function getBlockedForDate(date: Date, periods: BlockedPeriodWithDates[]): BlockedPeriodWithDates[] {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return periods.filter((p) => d >= p.vonDate && d <= p.bisDate);
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const count = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= count; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Montag als erster Tag
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateDMY(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/* ───────────────────────── Komponente ──────────────────────────────── */

export function PickupCalendar({ periods }: PickupCalendarProps) {
  const [aktuellesDatum, setAktuellesDatum] = useState(new Date());
  const [ansicht, setAnsicht] = useState<Ansicht>("monat");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [neuVon, setNeuVon] = useState("");
  const [neuBis, setNeuBis] = useState("");
  const [neuGrund, setNeuGrund] = useState("");
  const [loading, setLoading] = useState(false);

  const periodsWithDates = useMemo<BlockedPeriodWithDates[]>(
    () =>
      periods.map((p) => ({
        ...p,
        vonDate: new Date(p.von_datum),
        bisDate: new Date(p.bis_datum),
      })),
    [periods]
  );

  const heute = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  /* ─────────────── Navigation ──────────────────────────────────────── */
  const handlePrev = useCallback(() => {
    if (ansicht === "monat") setAktuellesDatum((d) => addMonths(d, -1));
    else if (ansicht === "woche") setAktuellesDatum((d) => addDays(d, -7));
    else setAktuellesDatum((d) => addMonths(d, -12));
  }, [ansicht]);

  const handleNext = useCallback(() => {
    if (ansicht === "monat") setAktuellesDatum((d) => addMonths(d, 1));
    else if (ansicht === "woche") setAktuellesDatum((d) => addDays(d, 7));
    else setAktuellesDatum((d) => addMonths(d, 12));
  }, [ansicht]);

  const handleHeute = useCallback(() => {
    setAktuellesDatum(new Date());
  }, []);

  /* ─────────────── Dialog-Handling ─────────────────────────────────── */
  const openDayDialog = useCallback(
    (date: Date) => {
      const jsDay = date.getDay();
      if (jsDay === 0 || jsDay === 6) {
        toast.info("Wochenende — keine Abholungen möglich");
        return;
      }
      setSelectedDate(date);
      const blocked = getBlockedForDate(date, periodsWithDates);
      if (blocked.length > 0) {
        setDialogOpen(true);
      } else {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${d}`;
        setNeuVon(iso);
        setNeuBis(iso);
        setNeuGrund("");
        setAddDialogOpen(true);
      }
    },
    [periodsWithDates]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const result = await removeBlockedPeriod(id);
      if (result.ok) {
        toast.success("Blocker gelöscht");
        setDialogOpen(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    },
    []
  );

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!neuVon || !neuBis || !neuGrund) {
        toast.error("Bitte alle Felder ausfüllen");
        return;
      }
      setLoading(true);
      const result = await addBlockedPeriod(neuVon, neuBis, neuGrund);
      setLoading(false);
      if (result.ok) {
        toast.success("Blocker hinzugefügt");
        setAddDialogOpen(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    },
    [neuVon, neuBis, neuGrund]
  );

  /* ─────────────── Render: Monat ──────────────────────────────────── */
  const renderMonat = () => {
    const year = aktuellesDatum.getFullYear();
    const month = aktuellesDatum.getMonth();
    const days = getDaysInMonth(year, month);

    // Erster Tag des Monats (0=So, 1=Mo...)
    const firstDayOfWeek = days[0]?.getDay() || 0;
    // Offset damit Montag = erste Spalte
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const leereZellen = Array.from({ length: offset }, (_, i) => (
      <div key={`leer-${i}`} className="min-h-[80px] md:min-h-[100px]" />
    ));

    return (
      <div className="space-y-4">
        {/* Header: Wochentage */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WOCHENTAGE.map((tag) => (
            <div key={tag} className="text-xs font-semibold text-muted-foreground py-1">
              {tag}
            </div>
          ))}
        </div>

        {/* Tage */}
        <div className="grid grid-cols-7 gap-1">
          {leereZellen}
          {days.map((day) => {
            const blocked = isBlocked(day, periodsWithDates);
            const isHeute = isSameDay(day, heute);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <button
                key={day.toISOString()}
                onClick={() => openDayDialog(day)}
                className={`
                  relative min-h-[80px] md:min-h-[100px] rounded-md border p-1 text-left transition-colors hover:bg-muted/50
                  ${isWeekend ? "bg-muted/20" : "bg-background"}
                  ${isHeute ? "ring-2 ring-primary ring-offset-1" : ""}
                  ${blocked ? (blocked.typ === "feiertag" ? "bg-blue-50 hover:bg-blue-100" : "bg-orange-50 hover:bg-orange-100") : ""}
                `}
              >
                <span className={`text-sm font-medium ${isHeute ? "text-primary" : "text-foreground"}`}>
                  {day.getDate()}
                </span>
                {blocked ? (
                  <div className="mt-0.5 text-[10px] leading-tight md:text-xs">
                    <span
                      className={`block truncate ${
                        blocked.typ === "feiertag"
                          ? "text-blue-700"
                          : "text-orange-700"
                      }`}
                    >
                      {blocked.grund}
                    </span>
                  </div>
                ) : isWeekend ? (
                  <div className="mt-0.5 text-[10px] leading-tight md:text-xs">
                    <span className="block truncate text-gray-500">Wochenende</span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ─────────────── Render: Woche ──────────────────────────────────── */
  const renderWoche = () => {
    const start = getWeekStart(aktuellesDatum);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2">
          {WOCHENTAGE.map((tag, i) => {
            const day = days[i];
            const isHeute = isSameDay(day, heute);
            return (
              <div
                key={tag}
                className={`text-center py-2 text-sm font-semibold rounded-t-md ${
                  isHeute ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {tag} <span className="font-normal">{day.getDate()}.</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const blockers = getBlockedForDate(day, periodsWithDates);
            const isHeute = isSameDay(day, heute);
            return (
              <button
                key={day.toISOString()}
                onClick={() => openDayDialog(day)}
                className={`
                  min-h-[120px] rounded-md border p-2 text-left transition-colors hover:bg-muted/50
                  ${isHeute ? "ring-2 ring-primary ring-offset-1" : ""}
                `}
              >
                {blockers.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Frei</span>
                ) : (
                  <div className="space-y-1">
                    {blockers.map((b) => (
                      <div
                        key={b.id}
                        className={`rounded px-1.5 py-0.5 text-[10px] md:text-xs truncate ${
                          b.typ === "feiertag"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {b.grund}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ─────────────── Render: Jahr ───────────────────────────────────── */
  const renderJahr = () => {
    const year = aktuellesDatum.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map((monthIndex) => {
          const monthDays = getDaysInMonth(year, monthIndex);
          const firstDay = monthDays[0]?.getDay() || 0;
          const offset = firstDay === 0 ? 6 : firstDay - 1;

          return (
            <div key={monthIndex} className="rounded-lg border bg-card p-3">
              <h3 className="text-sm font-semibold mb-2 text-center">
                {MONATS_NAMEN[monthIndex]}
              </h3>
              <div className="grid grid-cols-7 gap-0.5">
                {WOCHENTAGE.map((t) => (
                  <div key={t} className="text-[9px] text-center text-muted-foreground">
                    {t}
                  </div>
                ))}
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`e-${i}`} />
                ))}
                {monthDays.map((day) => {
                  const blocked = isBlocked(day, periodsWithDates);
                  const isHeute = isSameDay(day, heute);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setAktuellesDatum(day);
                        setAnsicht("monat");
                      }}
                      className={`
                        aspect-square flex items-center justify-center rounded text-[10px] md:text-xs
                        ${isHeute ? "ring-1 ring-primary font-bold" : ""}
                        ${blocked ? (blocked.typ === "feiertag" ? "bg-blue-200 text-blue-800" : "bg-orange-200 text-orange-800") : "hover:bg-muted"}
                      `}
                      title={blocked?.grund || ""}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ─────────────── Haupt-Render ──────────────────────────────────── */
  const titelText =
    ansicht === "monat"
      ? `${MONATS_NAMEN[aktuellesDatum.getMonth()]} ${aktuellesDatum.getFullYear()}`
      : ansicht === "woche"
      ? `KW ${getWeekStart(aktuellesDatum).toLocaleDateString("de-DE")}`
      : `${aktuellesDatum.getFullYear()}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleHeute}>
            Heute
          </Button>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">{titelText}</h2>
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
          {(["monat", "woche", "jahr"] as Ansicht[]).map((a) => (
            <button
              key={a}
              onClick={() => setAnsicht(a)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                ansicht === a
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {a === "monat" ? "Monat" : a === "woche" ? "Woche" : "Jahr"}
            </button>
          ))}
        </div>
      </div>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-blue-200" />
          <span>Feiertag</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-orange-200" />
          <span>Manueller Blocker</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-gray-200" />
          <span>Wochenende</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm ring-1 ring-primary" />
          <span>Heute</span>
        </div>
      </div>

      {/* Kalender */}
      {ansicht === "monat" && renderMonat()}
      {ansicht === "woche" && renderWoche()}
      {ansicht === "jahr" && renderJahr()}

      {/* Detail-Dialog: Blocker anzeigen */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDate?.toLocaleDateString("de-DE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedDate &&
              getBlockedForDate(selectedDate, periodsWithDates).map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    p.typ === "feiertag"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{p.grund}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateDMY(p.vonDate)}
                      {p.von_datum !== p.bis_datum &&
                        ` – ${formatDateDMY(p.bisDate)}`}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {p.typ === "feiertag" ? "Feiertag (automatisch)" : "Manuell"}
                    </div>
                  </div>
                  {p.typ === "manuell" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(p.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Schließen
            </Button>
            <Button
              onClick={() => {
                setDialogOpen(false);
                if (selectedDate) {
                  const y = selectedDate.getFullYear();
                  const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                  const d = String(selectedDate.getDate()).padStart(2, "0");
                  const iso = `${y}-${m}-${d}`;
                  setNeuVon(iso);
                  setNeuBis(iso);
                  setNeuGrund("");
                  setAddDialogOpen(true);
                }
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Blocker hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Neuer Blocker Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Blocker hinzufügen</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Von</label>
                <input
                  type="date"
                  value={neuVon}
                  onChange={(e) => setNeuVon(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Bis</label>
                <input
                  type="date"
                  value={neuBis}
                  onChange={(e) => setNeuBis(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Grund</label>
              <input
                type="text"
                placeholder="z.B. Betriebsferien"
                value={neuGrund}
                onChange={(e) => setNeuGrund(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm border-input bg-background"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Speichern…" : "Speichern"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
