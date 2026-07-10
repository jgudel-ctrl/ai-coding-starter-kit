"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Search, Loader2 } from "lucide-react";

/**
 * Live-Suchfeld + Inaktiv-Toggle für die Kundenliste.
 * Tippt der Nutzer, wird nach kurzer Pause (Debounce) automatisch
 * die URL (?search=...) aktualisiert -> Serverkomponente lädt gefiltert nach.
 * Kein Klick auf "Suchen" nötig.
 */
export function KundenSearch({
  initial,
  showInactive: initialShowInactive,
}: {
  initial?: string;
  showInactive?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initial ?? "");
  const [showInactive, setShowInactive] = useState(initialShowInactive ?? false);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suche debouncen
  useEffect(() => {
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

  // Toggle für inaktive Kunden
  const handleToggle = (checked: boolean) => {
    setShowInactive(checked);
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.set("showInactive", "true");
    } else {
      params.delete("showInactive");
    }
    startTransition(() => {
      router.replace(`/kunden?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex items-center gap-4">
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
      <div className="flex items-center gap-2">
        <Switch
          id="show-inactive"
          checked={showInactive}
          onCheckedChange={handleToggle}
        />
        <label
          htmlFor="show-inactive"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          {showInactive ? "Alle" : "Nur Aktive"}
        </label>
      </div>
    </div>
  );
}
