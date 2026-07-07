"use client";

import { useEffect, useRef, useState } from "react";
import { DriverTour } from "@/lib/actions/driver-tours";
import { Loader2, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface DriverMapProps {
  tours: DriverTour[];
}

export function DriverMap({ tours }: DriverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let map: any;

    async function initMap() {
      try {
        if (!mapRef.current) return;

        const L = (await import("leaflet")).default;

        // Deutschland-Zentrum als Default
        map = L.map(mapRef.current).setView([51.1657, 10.4515], 6);

        // OpenStreetMap Tiles
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);

        setIsLoading(false);
      } catch (err) {
        console.error("Karten-Fehler:", err);
        setIsLoading(false);
      }
    }

    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [tours]);

  if (tours.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">Karte</h2>
      <div className="relative h-[400px] w-full overflow-hidden rounded-lg border border-border md:h-[500px]">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        <div ref={mapRef} className="h-full w-full" />

        {/* Hinweis: Pins bei Bedarf später hinzufügen */}
        {!isLoading && (
          <div className="absolute bottom-2 left-2 z-[400] rounded-md bg-white/90 px-3 py-2 text-xs shadow-md">
            <MapPin className="mr-1 inline h-3 w-3 text-muted-foreground" />
            Karten-Pins mit Kunden-Adressen folgen bei Bedarf
          </div>
        )}
      </div>
    </div>
  );
}
