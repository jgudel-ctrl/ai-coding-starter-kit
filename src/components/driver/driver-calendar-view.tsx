"use client";

import { DriverTour } from "@/lib/actions/driver-tours";
import { DriverTourCard } from "./driver-tour-card";
import { CalendarDays } from "lucide-react";

interface DriverCalendarViewProps {
  tours: DriverTour[];
}

export function DriverCalendarView({ tours }: DriverCalendarViewProps) {
  // Gruppiere Touren nach Datum
  const toursByDate = tours.reduce((acc, tour) => {
    const date = tour.geplantes_abholdatum || "Unbekannt";
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(tour);
    return acc;
  }, {} as Record<string, DriverTour[]>);

  // Sortiere Datums-Keys
  const sortedDates = Object.keys(toursByDate).sort();

  const formatDate = (dateStr: string) => {
    if (dateStr === "Unbekannt") return "Unbekannt";
    const date = new Date(dateStr);
    const today = new Date().toISOString().split("T")[0];
    
    if (dateStr === today) {
      return "Heute";
    }
    
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date} className="space-y-3">
          {/* Tages-Header */}
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              {formatDate(date)}
            </h3>
            <span className="ml-auto text-sm text-muted-foreground">
              {toursByDate[date].length} {toursByDate[date].length === 1 ? "Abholung" : "Abholungen"}
            </span>
          </div>

          {/* Touren für diesen Tag */}
          <div className="space-y-3">
            {toursByDate[date].map((tour) => (
              <DriverTourCard key={tour.id} tour={tour} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
