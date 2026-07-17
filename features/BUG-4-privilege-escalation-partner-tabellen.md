# BUG-4: Privilege Escalation über user_metadata bei Partner-Tabellen

**Status:** ✅ Behoben (2026-07-17)
**Projekt:** TMS 2.0
**Priorität:** Kritisch (Security — Rechteausweitung, jeder Nutzer konnte sich selbst zum Admin machen)
**Autor:** Claude Code (KI-Entwickler-Session)
**Datum:** 2026-07-17

---

## 1. Problem-Statement

Bei der Nachkontrolle der übrigen Security-Advisor-Meldungen (im Anschluss an BUG-3) fiel auf, dass die Admin-Policies von `tms.partners`, `tms.partner_contacts`, `tms.partner_addresses` und `tms.partner_billing_settings` folgendes prüften:

```sql
(current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'role') = 'admin'
```

`user_metadata` ist im Supabase-Auth-Modell das Feld, das **jeder eingeloggte Nutzer selbst über die normale Client-API ändern kann** (`supabase.auth.updateUser({ data: {...} })`) — im Gegensatz zu `app_metadata`, das nur serverseitig/administrativ änderbar ist.

**Live nachgewiesen:** Ein Test-Nutzer mit Rolle `werker` (kein Admin, weder in `public.profiles.roles` noch sonst irgendwo autorisiert) konnte sich per `auth.updateUser({ data: { role: 'admin' } })` selbst zu `role: 'admin'` befördern und danach erfolgreich in `tms.partner_contacts` schreiben.

**Werkstatt-Vergleich:** Die Zugangskontrolle zum Chef-Büro prüfte das selbstbeschriftete Namensschild am Hemd des Mitarbeiters statt der offiziellen Personalakte.

---

## 2. Root-Cause

Die vier `admin_all_*`-Policies stammten offenbar aus einer früheren Version des Rollen-Systems (Einzel-`role`-Spalte, siehe `0001_auth_profiles.sql`) und wurden nicht mit umgestellt, als das Projekt auf die serverseitige `profiles.roles`-Array-Prüfung wechselte (`0002_multi_role.sql`, auch verwendet in `tms.manufacturers`, `tms.products`, `tms.customer_groups`).

---

## 3. Fix

Migration: `supabase/migrations/20260717123000_partner_tables_privilege_escalation_fix.sql`

1. Alle vier `admin_all_*`-Policies ersetzt durch den Standard-Check gegen `public.profiles` (serverseitig, nicht vom Nutzer änderbar):
   ```sql
   EXISTS (
     SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
     AND 'admin'::user_role = ANY(roles)
     AND status = 'aktiv'
   )
   ```
2. Zusätzlich (Defense in Depth): unnötige `anon`-Tabellen-Grants auf allen vier Tabellen entfernt

**Live verifiziert:**
- ❌ Test-Nutzer (Rolle `werker`) versucht Selbst-Beförderung via `user_metadata.role = 'admin'` + Session-Refresh → JWT zeigt `role: admin`, aber Insert in `tms.partner_contacts` wird weiterhin durch RLS blockiert
- ✅ Test-Nutzer, **echt** befördert über `public.profiles.roles = ['admin']`, kann weiterhin normal schreiben (keine Regression)
- ✅ Datenbankweite Prüfung: keine verbleibende Policy referenziert noch `user_metadata` für Berechtigungsentscheidungen

Alle Test-Nutzer und Test-Datensätze wurden nach dem Test wieder entfernt.

---

## 4. Akzeptanzkriterien

- [x] Alle vier Partner-Tabellen-Policies auf `profiles.roles`-Check umgestellt
- [x] Selbst-Beförderung über `user_metadata` live getestet und bestätigt blockiert
- [x] Echte Admin-Berechtigung (`profiles.roles`) weiterhin funktionsfähig
- [x] Datenbankweite Suche nach weiteren `user_metadata`-basierten Policies — keine gefunden
- [x] anon-Grants auf den vier Tabellen entfernt

---

## 5. Empfehlung für die Zukunft

Bei künftigen Migrationen/Policies: **niemals** `user_metadata` (bzw. `raw_user_meta_data`) für Autorisierungsentscheidungen verwenden — nur `public.profiles.roles` (serverseitig) oder `app_metadata` (nur admin-änderbar). Diese Regel könnte in `.claude/rules/backend.md` ergänzt werden.
