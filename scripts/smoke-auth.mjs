// Live-Smoke-Test: meldet den ersten Admin an und prüft Auth + RLS.
// Ausführen: node --env-file=.env.local scripts/smoke-auth.mjs
// Liest Zugangsdaten aus FIRST_ADMIN_PASSWORD.txt (gitignored).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const [email, password] = readFileSync("FIRST_ADMIN_PASSWORD.txt", "utf8")
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

const supabase = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failed = false;
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failed = true;
};

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email,
  password,
});
check("Login als Admin erfolgreich", !signInErr && !!signIn.session);

const { data: profile } = await supabase
  .from("profiles")
  .select("role, status")
  .eq("id", signIn.user?.id)
  .single();
check("Eigenes Profil hat Rolle admin", profile?.role === "admin");
check("Eigenes Konto ist aktiv", profile?.status === "aktiv");

// Admin sieht per RLS ALLE Profile.
const { data: all, error: allErr } = await supabase.from("profiles").select("id");
check("Admin sieht alle Profile (RLS)", !allErr && (all?.length ?? 0) >= 1);
console.log(`  -> ${all?.length ?? 0} Profile sichtbar`);

await supabase.auth.signOut();
check("Logout erfolgreich", true);

process.exit(failed ? 1 : 0);
