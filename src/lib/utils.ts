import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cent-Betrag in Euro-Format umwandeln
 * z.B. 15000 → "150,00 €"
 */
export function formatCent(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const euros = cents / 100;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}
