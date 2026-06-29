import { z } from "zod";
import { USER_ROLES } from "@/lib/roles";

// Mindest-Passwortlänge laut Spec (MVP: nur Länge, keine Komplexitätsregel — AC/Decision Log).
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt-Grenze von Supabase Auth

const passwordField = z
  .string()
  .min(PASSWORD_MIN, `Mindestens ${PASSWORD_MIN} Zeichen`)
  .max(PASSWORD_MAX, `Höchstens ${PASSWORD_MAX} Zeichen`);

/** Login-Formular. */
export const loginSchema = z.object({
  email: z.string().min(1, "E-Mail erforderlich").email("Ungültige E-Mail"),
  password: z.string().min(1, "Passwort erforderlich"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** „Passwort vergessen" — nur E-Mail. */
export const resetRequestSchema = z.object({
  email: z.string().min(1, "E-Mail erforderlich").email("Ungültige E-Mail"),
});
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

/** Passwort beim ersten Login / nach Admin-Reset ändern. */
export const changePasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string().min(1, "Bitte Passwort wiederholen"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirm"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Admin legt einen neuen Nutzer mit Start-Passwort an. */
export const createUserSchema = z.object({
  email: z.string().min(1, "E-Mail erforderlich").email("Ungültige E-Mail"),
  fullName: z.string().min(2, "Name erforderlich"),
  role: z.enum(USER_ROLES, { message: "Rolle wählen" }),
  password: passwordField,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
