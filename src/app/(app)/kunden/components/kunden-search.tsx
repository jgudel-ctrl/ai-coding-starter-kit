"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

/**
 * Live-Suchfeld für die Kundenliste.
 * Tippt der Nutzer, wird nach kurzer Pause (Debounce) automatisch
 * die URL (?search=...) aktualisiert -> Serverkomponente lädt gefiltert nach.
 * Kein Klick auf "Suchen" nötig.
 */
export function KundenSearch({ initial }: { initial?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial ?? "");
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Debounce: erst 300ms nach dem letzten Tastendruck suchen
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) {
        params.set("search", trimmed);
      } else {
        params.delete("search");
      }
      startTransition(() => {
        router.replace(`/kunden?${params.toString()}`, { scroll: false });
      });
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Kunde suchen..."
        className="pl-9 pr-9"
        autoComplete="off"
        aria-label="Kunde suchen"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
