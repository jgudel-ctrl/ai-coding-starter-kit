"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient, getCurrentProfile, type Profile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema, type CreateUserInput } from "@/lib/validations/auth";
import { USER_ROLES, isAdmin, type UserRole } from "@/lib/roles";

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.roles) || profile.status !== "aktiv") return null;
  return profile;
}

/** Anzahl aktiver Admins (für den „letzter Admin"-Schutz, AC-20). */
async function countActiveAdmins(): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .contains("roles", ["admin"])
    .eq("status", "aktiv");
  return count ?? 0;
}

function validRoles(roles: UserRole[]): boolean {
  return roles.length > 0 && roles.every((r) => USER_ROLES.includes(r));
}

export async function createUserAction(input: CreateUserInput): Promise<Result> {
  if (!(await requireAdmin())) return { ok: false, error: "Keine Berechtigung." };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }
  const { email, fullName, roles, password } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, roles, must_change_password: true },
  });
  if (error) {
    const dup = /registered|exists|duplicate/i.test(error.message);
    return { ok: false, error: dup ? "Diese E-Mail ist bereits vergeben." : "Anlegen fehlgeschlagen." };
  }

  revalidatePath("/verwaltung/nutzer");
  return { ok: true };
}

export async function updateRolesAction(userId: string, roles: UserRole[]): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Keine Berechtigung." };
  if (!validRoles(roles)) return { ok: false, error: "Mindestens eine gültige Rolle wählen." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("roles, status")
    .eq("id", userId)
    .single<{ roles: UserRole[]; status: string }>();
  if (!target) return { ok: false, error: "Nutzer nicht gefunden." };

  // Letzten aktiven Admin nicht entmachten (Admin-Rolle entzogen).
  if (isAdmin(target.roles) && target.status === "aktiv" && !roles.includes("admin")) {
    if ((await countActiveAdmins()) <= 1) {
      return { ok: false, error: "Dem letzten aktiven Admin kann die Admin-Rolle nicht entzogen werden." };
    }
  }

  const { error } = await admin.from("profiles").update({ roles }).eq("id", userId);
  if (error) return { ok: false, error: "Konnte Rollen nicht ändern." };

  revalidatePath("/verwaltung/nutzer");
  return { ok: true };
}

export async function toggleStatusAction(userId: string): Promise<Result> {
  const me = await requireAdmin();
  if (!me) return { ok: false, error: "Keine Berechtigung." };

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("profiles")
    .select("roles, status")
    .eq("id", userId)
    .single<{ roles: UserRole[]; status: string }>();
  if (!target) return { ok: false, error: "Nutzer nicht gefunden." };

  const next = target.status === "aktiv" ? "deaktiviert" : "aktiv";

  // Letzten aktiven Admin nicht deaktivieren.
  if (isAdmin(target.roles) && target.status === "aktiv" && next === "deaktiviert") {
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
