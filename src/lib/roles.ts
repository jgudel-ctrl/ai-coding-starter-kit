// Rollenmodell TMS 2.0 — siehe features/PROJ-1-auth-rollen.md
// Eine Rolle pro Nutzer (MVP). Werte werden 1:1 in profiles.role gespeichert.

export const USER_ROLES = [
  "admin",
  "arbeitsvorbereitung",
  "wareneingang",
  "werker",
  "qs",
  "warenausgang",
  "fahrer",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Anzeige-Labels (Deutsch) für UI-Ausgaben. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin / Verwaltung",
  arbeitsvorbereitung: "Arbeitsvorbereitung",
  wareneingang: "Wareneingang",
  werker: "Werker / Maschine",
  qs: "Qualitätssicherung",
  warenausgang: "Warenausgang",
  fahrer: "Fahrer",
};

/** Startseite je Rolle nach dem Login. */
export const ROLE_HOME: Record<UserRole, string> = {
  admin: "/dashboard",
  arbeitsvorbereitung: "/dashboard",
  wareneingang: "/dashboard",
  werker: "/dashboard",
  qs: "/dashboard",
  warenausgang: "/dashboard",
  fahrer: "/dashboard",
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

/** Kontostatus eines Nutzers. */
export type UserStatus = "aktiv" | "deaktiviert";
