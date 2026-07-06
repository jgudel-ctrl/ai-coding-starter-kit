// Gemeinsame Konstanten für Auftrags-Defaults
// KEIN "use server" — wird von Client und Server geteilt

export const INBOUND_OPTIONS = [
  "Eigenversand durch Kunde",
  "Abholservice durch Gudel Werkzeuge",
  "Bestellung über schärfen.de-Shop",
  "Persönliche Anlieferung durch Kunde",
  "Versand über schärfen.de-Versandbox",
] as const;

export const OUTBOUND_OPTIONS = [
  "Versenden",
  "Selbst Abholer",
  "Bringen",
] as const;

export const PICKUP_STATUS_OPTIONS = [
  "Anruf",
  "Automatisch",
] as const;

export const PICKUP_DAY_OPTIONS = [
  { value: 1, label: "Montag" },
  { value: 2, label: "Dienstag" },
  { value: 3, label: "Mittwoch" },
  { value: 4, label: "Donnerstag" },
  { value: 5, label: "Freitag" },
] as const;

export const PICKUP_DAY_MAP: Record<number, string> = {
  1: "Montag",
  2: "Dienstag",
  3: "Mittwoch",
  4: "Donnerstag",
  5: "Freitag",
};
