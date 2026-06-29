"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient, getCurrentProfile, type Profile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/auth";
import { USER_ROLES, type UserRole } from "@/lib/roles";

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin" || profile.status !== "aktiv") return null;
  return profile;
}

/** Anzahl aktiver Admins (für den „letzter Admin"-Schutz, AC-20). */
async function countActiveAdmins(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("status", "aktiv");
  return count ?? 0;
}

export async function createUserAction(input: CreateUserInput): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Keine Berechtigung." };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  const { email, fullName, role, password } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, must_change_password: true },
  });
  if (error) {
    const dup = /registered|exists|duplicate/i.test(error.message);
    return { ok: false, error: dup ? "Diese E-Mail ist bereits vergeben." : "Anlegen fehlgeschlagen." };
  }

  revalidatePath("/verwaltung/nutzer");
  return { ok: true };
}

export async function updateRoleAction(userId: string, role: UserRole): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Keine Berechtigung." };
  if (!USER_ROLES.includes(role)) return { ok: false, error: "Unbekannte Rolle." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single<{ role: UserRole; status: string }>();
  if (!target) return { ok: false, error: "Nutzer nicht gefunden." };

  // Letzten aktiven Admin nicht herabstufen.
  if (target.role === "admin" && target.status === "aktiv" && role !== "admin") {
    if ((await countActiveAdmins()) <= 1) {
      return { ok: false, error: "Der letzte aktive Admin kann nicht herabgestuft werden." };
    }
  }

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, error: "Konnte Rolle nicht ändern." };

  revalidatePath("/verwaltung/nutzer");
  return { ok: true };
}

export async function toggleStatusAction(userId: string): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Keine Berechtigung." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .single<{ role: UserRole; status: string }>();
  if (!target) return { ok: false, error: "Nutzer nicht gefunden." };

  const next = target.status === "aktiv" ? "deaktiviert" : "aktiv";

  // Letzten aktiven Admin nicht deaktivieren.
  if (target.role === "admin" && target.status === "aktiv" && next === "deaktiviert") {
    if ((await countActiveAdmins()) <= 1) {
      return { ok: false, error: "Der letzte aktive Admin kann nicht deaktiviert werden." };
    }
  }

  const { error } = await admin.from("profiles").update({ status: next }).eq("id", userId);
  if (error) return { ok: false, error: "Konnte Status nicht ändern." };

  revalidatePath("/verwaltung/nutzer");
  return { ok: true };
}

export type ResetResult =
  | { ok: true; password: string }
  | { ok: false; error: string };

export async function resetPasswordAction(userId: string): Promise<ResetResult> {
  if (!(await requireAdmin())) return { ok: false, error: "Keine Berechtigung." };

  const password = randomBytes(9).toString("base64url"); // ~12 Zeichen
  const admin = createAdminClient();

  const { error: authErr } = await admin.auth.admin.updateUserById(userId, { password });
  if (authErr) return { ok: false, error: "Konnte Passwort nicht zurücksetzen." };

  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);

  revalidatePath("/verwaltung/nutzer");
  return { ok: true, password };
}

/** Aktuellen Nutzer ausloggen ist in auth.ts; hier nur Nutzerdaten-Aktionen. */
