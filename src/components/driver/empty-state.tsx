"use client";

import { Truck } from "lucide-react";

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "Heute keine Abholungen geplant" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 py-16 text-center">
      <div className="mb-4 rounded-full bg-primary/10 p-4">
        <Truck className="h-8 w-8 text-primary" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {message}
      </h3>
      <p className="max-w-xs text-sm text-muted-foreground">
        Für dich sind aktuell keine Abholungen eingetragen. Komm später wieder oder wende dich an die Arbeitsvorbereitung.
      </p>
    </div>
  );
}
