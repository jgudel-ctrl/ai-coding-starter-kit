"use client";

import { useState } from "react";
import { Check, MapPin, ExternalLink } from "lucide-react";
import { DriverTour, markTourAsCollected } from "@/lib/actions/driver-tours";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface DriverTourCardProps {
  tour: DriverTour;
}

export function DriverTourCard({ tour }: DriverTourCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const address = [tour.partner.street, `${tour.partner.zip} ${tour.partner.city}`]
    .filter(Boolean)
    .join(", ");

  // Maps-Link generieren (Google Maps)
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${tour.partner.company_name} ${address}`
  )}`;

  async function handleMarkCollected() {
    setIsLoading(true);
    const result = await markTourAsCollected(tour.id);
    if (result.ok) {
      router.refresh();
    } else {
      alert("Fehler: " + result.error);
    }
    setIsLoading(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* Kunden-Name */}
      <div className="mb-2">
        <h3 className="text-base font-semibold text-foreground">
          {tour.partner.company_name}
        </h3>
      </div>

      {/* Adresse */}
      <div className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <div>{tour.partner.street}</div>
          <div>{tour.partner.zip} {tour.partner.city}</div>
        </div>
      </div>

      {/* Status + Buttons */}
      <div className="flex items-center justify-between gap-2">
        {/* Status-Badge */}
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
          Offen
        </span>

        {/* Action-Buttons */}
        <div className="flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Navigation
          </a>

          <Button
            size="sm"
            onClick={handleMarkCollected}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Check className="mr-1 h-4 w-4" />
            {isLoading ? "..." : "Abgeholt"}
          </Button>
        </div>
      </div>
    </div>
  );
}
