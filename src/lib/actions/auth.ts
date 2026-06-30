"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  changePasswordSchema,
  resetRequestSchema,
  type LoginInput,
  type ChangePasswordInput,
  type ResetRequestInput,
} from "@/lib/validations/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function signInAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bitte E-Mail und Passwort eingeben." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // Bewusst keine Auskunft, ob die E-Mail existiert (AC-2).
  if (error || !data.session) {
    return { ok: false, error: "E-Mail oder Passwort ist falsch." };
  }

  // Deaktivierte Konten sofort wieder abmelden.
  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .single<{ status: string }>();
  if (!profile || profile.status === "deaktiviert") {
    await supabase.auth.signOut();
    return { ok: false, error: "Dieses Konto ist deaktiviert." };
  }

  return { ok: true };
}

export async function requestPasswordResetAction(
  input: ResetRequestInput,
): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Bitte eine gültige E-Mail eingeben." };

  // Origin aus den Request-Headern (für den Rücklink in der E-Mail).
  // In Docker liefert host oft 0.0.0.0:3000 — daher ENV als Quelle der Wahrheit.
  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    h.get("origin") ??
    (h.get("host") ? `https://${h.get("host")}` : "");

  const supabase = await createClient();
  // Bei unbekannter E-Mail bewusst KEINE abweichende Antwort (keine Enumeration).
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=/passwort-aendern`,
  });

  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "Konnte das Passwort nicht ändern." };

  // Flag zurücksetzen (Nutzer darf profiles per RLS nicht selbst ändern -> Service-Role).
  const admin = createAdminClient();
  await admin.from("profiles").update({ must_change_password: false }).eq("id", user.id);

  return { ok: true };
}
