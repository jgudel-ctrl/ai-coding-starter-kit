import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Verbindlicher Seiten-Kopf-Baustein (Design-System): jede Seite startet mit einer
 * KOMPAKTEN Übersicht — ein paar KPIs + optional ein kleiner Chart — oberhalb der
 * eigentlichen Funktion. Regeln:
 *  - klein halten (max. ~⅓ des Bildschirms), nur ein schneller visueller Überblick,
 *  - leichtgewichtig (kein schweres Chart-Rendering; Charts nur wenn wirklich sinnvoll),
 *  - dezente Aufbau-Animation beim Öffnen (rein CSS via tailwindcss-animate),
 *  - die eigentliche Funktion beginnt direkt darunter und ist ohne Scrollen bedienbar.
 */

export type Kpi = {
  label: string;
  value: string | number;
  hint?: string;
  /** optionale Akzentfarbe für die Kennzahl (Hex), z.B. Stationsfarbe */
  accent?: string;
};

type PageOverviewProps = {
  kpis: Kpi[];
  /** optionaler kleiner Chart — nur setzen, wenn er echten Mehrwert bringt */
  chart?: React.ReactNode;
  className?: string;
};

export function PageOverview({ kpis, chart, className }: PageOverviewProps) {
  const cols =
    kpis.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3";

  return (
    <section
      aria-label="Übersicht"
      className={cn("grid gap-3", chart ? "lg:grid-cols-[2fr_1fr]" : "", className)}
    >
      <div className={cn("grid gap-3", cols)}>
        {kpis.map((k, i) => (
          <Card
            key={k.label}
            className="p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className="text-2xl font-bold leading-none tabular-nums"
              style={k.accent ? { color: k.accent } : undefined}
            >
              {k.value}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{k.label}</div>
            {k.hint && (
              <div className="text-[11px] text-muted-foreground/70">{k.hint}</div>
            )}
          </Card>
        ))}
      </div>
      {chart && (
        <Card
          className="p-3 sm:p-4 animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500"
          style={{ animationDelay: `${kpis.length * 60}ms` }}
        >
          {chart}
        </Card>
      )}
    </section>
  );
}
