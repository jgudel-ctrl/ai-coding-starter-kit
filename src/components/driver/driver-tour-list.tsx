"use client";

import { DriverTour } from "@/lib/actions/driver-tours";
import { DriverTourCard } from "./driver-tour-card";

interface DriverTourListProps {
  tours: DriverTour[];
}

export function DriverTourList({ tours }: DriverTourListProps) {
  if (tours.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">
        {tours.length} {tours.length === 1 ? "Abholung" : "Abholungen"} heute
      </h2>
      <div className="space-y-3">
        {tours.map((tour) => (
          <DriverTourCard key={tour.id} tour={tour} />
        ))}
      </div>
    </div>
  );
}
