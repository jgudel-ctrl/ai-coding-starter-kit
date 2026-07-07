// Einmaliges Seed-Skript: stellt den ERSTEN Admin sicher (Henne-Ei-Problem).
// Ausführen: node --env-file=.env.local scripts/seed-admin.mjs
// Idempotent: legt den Nutzer an ODER aktualisiert einen bestehenden, setzt ein
// frisches Start-Passwort und das Admin-Profil. Passwort -> FIRST_ADMIN_PASSWORD.txt
// (gitignored), niemals in die Konsole.

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EMAIL = "j.gudel@gudel-werkzeuge.de";
const FULL_NAME = "Jan Bernd Gudel";

if (!url || !serviceKey) {
  console.error("FEHLT: NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) {
  console.error("ERR listUsers:", listErr.message);
  process.exit(1);
}

let user = list?.users?.find(
  (u) => u.email?.toLowerCase() === EMAIL.toLowerCase(),
);

const password = randomBytes(12).toString("base64url");
const meta = { full_name: FULL_NAME, roles: ["admin"], must_change_password: true };

if (user) {
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, ...meta },
  });
  if (error) {
    console.error("ERR updateUser:", error.message);
    process.exit(1);
  }
  console.log("UPDATED — bestehender Nutzer als Admin gesetzt, Passwort erneuert.");
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) {
    console.error("ERR createUser:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log("CREATED — neuer Admin angelegt.");
}

// Profil sicherstellen (Trigger deckt nur INSERT ab; für bestehende Nutzer hier upserten).
const { error: profErr } = await admin.from("profiles").upsert(
  {
    id: user.id,
    email: user.email,
    full_name: FULL_NAME,
    roles: ["admin"],
    status: "aktiv",
    must_change_password: true,
  },
  { onConflict: "id" },
);
if (profErr) {
  console.error("ERR profile upsert:", profErr.message);
  process.exit(1);
}

writeFileSync("FIRST_ADMIN_PASSWORD.txt", `${user.email}\n${password}\n`);
console.log("OK — Start-Passwort steht in FIRST_ADMIN_PASSWORD.txt");
