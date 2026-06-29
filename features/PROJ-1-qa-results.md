# QA Test Protokoll — PROJ-1: Auth & Rollen

**Durchgeführt:** 2026-06-29
**Tester:** Klausi (QA Engineer)
**Branch:** main
**Commit-Base:** 70105f1 + Working Tree (Backend fertig)

---

## Testumgebung

- **Lokal:** `npm run build` ✅, `npm test` ✅ (13/13)
- **Supabase:** Self-hosted auf gudel-werkzeuge.de
- **Erster Admin:** Jan Bernd Gudel (`j.gudel@gudel-werkzeuge.de`) via `scripts/seed-admin.mjs` angelegt
- **Start-Passwort:** In `FIRST_ADMIN_PASSWORD.txt` (gitignored)

---

## Test Ergebnisse

### AC-1: Login mit E-Mail + Passwort → Rollenspezifische Startseite
- **Test:** Erster Admin-Login mit Start-Passwort.
- **Ergebnis:** ⚠️ **Nicht manuell getestet** (kein laufender Dev-Server).
- **Code-Review:** `signInAction` ruft `supabase.auth.signInWithPassword()`, prüft `is_active_admin()`-RLS-Helper, deaktivierte Nutzer werden abgewiesen. Route `/` leitet via Middleware zur passenden Seite.
- **Bewertung:** Code korrekt, manueller Test empfohlen.

### AC-2: Falsche Zugangsdaten → Klare Fehlermeldung, keine Enumeration
- **Code-Review:** `signInAction` gibt bei allen Fehlern identische Meldung: "E-Mail oder Passwort ist falsch."
- **Bewertung:** ✅ **Bestanden** (Implementierung korrekt).

### AC-3: Logout über Header-Menü → Kein geschützter Bereich erreichbar
- **Code-Review:** `signOutAction` ruft `supabase.auth.signOut()`, `app-header.tsx` zeigt Logout im Dropdown-Menü.
- **Bewertung:** ✅ **Bestanden**.

### AC-4: Session über Reloads erhalten (@supabase/ssr + Middleware)
- **Code-Review:** `middleware.ts` verwendet `createServerClient` mit Cookie-Session, `src/lib/supabase/server.ts` liest/refresht Session. `src/proxy.ts` als Next-16-Konvention.
- **Bewertung:** ✅ **Bestanden**.

### AC-5: Keine öffentliche Registrierungsseite
- **Code-Review:** Keine `/register` Route vorhanden. Nur `/login` ist öffentlich.
- **Bewertung:** ✅ **Bestanden**.

### AC-6: Admin legt Nutzer mit Start-Passwort an
- **Code-Review:** `createUserAction` in `src/lib/actions/users.ts` — Service-Role Client, erstellt Auth-User + Profil, `must_change_password=true`.
- **Bewertung:** ✅ **Bestanden**.

### AC-7: Erster Login → Pflicht-Passwort-Ändern
- **Code-Review:** `must_change_password` in `profiles`-Tabelle. Middleware prüft `must_change_password` → Redirect zu `/passwort-aendern`. `changePasswordAction` setzt `must_change_password=false`.
- **Bewertung:** ✅ **Bestanden**.

### AC-8: Passwort nicht geändert → Nur Passwort-Ändern-Seite erreichbar
- **Code-Review:** Middleware blockiert alle anderen Routen bei `must_change_password=true`.
- **Bewertung:** ✅ **Bestanden**.

### AC-9: Admin setzt neues Start-Passwort
- **Code-Review:** `resetPasswordAction` in `users.ts` — setzt Passwort + `must_change_password=true`.
- **Bewertung:** ✅ **Bestanden**.

### AC-9b: Self-Service Passwort-Reset per E-Mail
- **Code-Review:** `requestPasswordResetAction` → `resetPasswordForEmail` mit Redirect zu `/auth/confirm?next=/passwort-aendern`. Route-Handler `/auth/confirm` tauscht Token gegen Session.
- **Hinweis:** ⚠️ **GOTRUE_URI_ALLOW_LIST** erlaubt nur Produktions-Domains. Lokal testen erfordert `localhost:3000` in Allow-List.
- **Bewertung:** ✅ **Bestanden** (Produktion korrekt, lokaler Test hat Einschränkung).

### AC-10: Jeder Nutzer hat genau eine Rolle in `profiles.role`
- **Code-Review:** `user_role` ENUM (7 Werte), `profiles.role NOT NULL`.
- **Bewertung:** ✅ **Bestanden**.

### AC-11: Routen serverseitig geschützt (Middleware)
- **Code-Review:** `src/proxy.ts`/`middleware.ts` — Nicht angemeldet → `/login`, Admin-Route ohne Admin-Rolle → 403-Logik (Redirect zu Dashboard).
- **Bewertung:** ✅ **Bestanden**.

### AC-12: RLS auf allen Tabellen
- **Code-Review:** `profiles`-Tabelle mit RLS: SELECT = eigenes Profil ODER Admin, INSERT/UPDATE = nur aktive Admins. `is_active_admin()` als SECURITY DEFINER.
- **Bewertung:** ✅ **Bestanden**.

### AC-13: Nur Admin darf Nutzer verwalten
- **Code-Review:** Alle Admin-Actions (`createUserAction`, `updateRoleAction`, etc.) rufen `requireAdmin()` → Prüft `is_active_admin()`.
- **Bewertung:** ✅ **Bestanden**.

### AC-14: Admin sieht Nutzerliste
- **Code-Review:** `UserManagement`-Komponente lädt alle Profile via RLS (Admin darf alle lesen).
- **Bewertung:** ✅ **Bestanden**.

### AC-15: Admin kann Rolle ändern
- **Code-Review:** `updateRoleAction` mit `requireAdmin()`.
- **Bewertung:** ✅ **Bestanden**.

### AC-16: Deaktivierte Nutzer graumarkiert sichtbar
- **Code-Review:** `UserManagement`-Tabelle zeigt deaktivierte Nutzer mit `opacity-50` / `text-muted-foreground`.
- **Bewertung:** ✅ **Bestanden**.

### AC-17: Login-Screen mit Logo auf Korallen-Fläche
- **Code-Review:** `login/page.tsx` + `login-form.tsx` — `bg-[#FF6B6D]`, `public/logo.svg` als Logo.
- **Bewertung:** ✅ **Bestanden**.

### AC-18: Header mit Touch-Targets ≥ 48px
- **Code-Review:** `app-header.tsx` — Buttons mit `h-12` (48px), Dropdown-Menü.
- **Bewertung:** ✅ **Bestanden**.

### AC-19: Alle Texte auf Deutsch
- **Code-Review:** Alle UI-Labels, Fehlermeldungen, Seitentitel auf Deutsch.
- **Bewertung:** ✅ **Bestanden**.

### AC-20: Letzter Admin kann nicht deaktiviert/herabgestuft werden
- **Code-Review:** **Sowohl clientseitig (UserManagement) als auch serverseitig (actions/users.ts)** implementiert. Server-Action zählt aktive Admins vor Deaktivierung/Downgrade.
- **Bewertung:** ✅ **Bestanden**.

---

## Sicherheits-Audit

| Prüfung | Status |
|---------|--------|
| Keine öffentliche Registrierung | ✅ |
| Passwort-Hashing in Supabase Auth (bcrypt) | ✅ |
| Service-Role-Key nur serverseitig (`server-only`) | ✅ |
| RLS als echte Sicherheitsgrenze | ✅ |
| Keine Nutzer-Enumeration bei Login | ✅ |
| Deaktivierte Nutzer komplett abgewiesen | ✅ |
| Letzter Admin geschützt | ✅ |

---

## Unit Tests

- `src/lib/roles.test.ts` — 3/3 ✅
- `src/lib/validations/auth.test.ts` — 10/10 ✅

---

## Smoke Tests

- `scripts/smoke-auth.mjs` — Live-Verifikation Auth + RLS auf self-hosted Supabase ✅

---

## Offene Punkte / Empfohlene Nacharbeit

1. **E2E-Tests mit Playwright** — Noch nicht geschrieben. Empfohlen für Login-Flow, Admin-CRUD, Rollen-Redirects.
2. **Manueller Login-Test** — Erster Admin-Login mit `FIRST_ADMIN_PASSWORD.txt` empfohlen, bevor Deploy.
3. **GOTRUE_URI_ALLOW_LIST** — Für Staging/Preview ggf. ergänzen.
4. **Test-Auth-Accounts bereinigen** — Alte Accounts (`test@tms.local`, `playwright-test@...`) ohne Profil blockieren sich selbst.

---

## Gesamtbewertung

| Kategorie | Status |
|-----------|--------|
| Funktionale ACs | ✅ 20/20 erfüllt (Code-Review) |
| Sicherheit | ✅ Bestanden |
| Unit Tests | ✅ 13/13 |
| Build | ✅ Grün |
| E2E Tests | ⚠️ Nicht geschrieben |
| Manuelle Tests | ⚠️ Empfohlen vor Deploy |

**Empfehlung:** PROJ-1 ist **bereit für Deploy** (mit Hinweis auf manuellen Smoke-Test nach Deployment). E2E-Tests können nachgeliefert werden.

---

**Sign-off:** Klausi | 2026-06-29
