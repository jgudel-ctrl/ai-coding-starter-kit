"use client";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════
   Typ-Toggle: Artikel | Service | Beides
   ═══════════════════════════════════════════ */

type TypeToggleProps = {
  value: "PRODUCT" | "SERVICE" | "all";
  onChange: (value: "PRODUCT" | "SERVICE" | "all") => void;
};

const OPTIONS = [
  { key: "PRODUCT" as const, label: "📦 Artikel" },
  { key: "SERVICE" as const, label: "🔧 Service" },
  { key: "all" as const, label: "Beides" },
];

export function TypeToggle({ value, onChange }: TypeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            value === opt.key
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
