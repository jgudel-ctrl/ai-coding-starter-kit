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
