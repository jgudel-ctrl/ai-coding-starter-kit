# BUG-3: RLS-Lücke — anon-Zugriff auf tms.products & tms.customer_groups

**Status:** ✅ Behoben (2026-07-17)
**Projekt:** TMS 2.0
**Priorität:** Kritisch (Security — ungeschützter Zugriff auf Produktivdaten)
**Autor:** Claude Code (KI-Entwickler-Session)
**Datum:** 2026-07-17

---

## 1. Problem-Statement

Der Supabase-Security-Advisor meldete: `tms.products` und `tms.customer_groups` sind "public, aber RLS wurde nicht aktiviert".

Live-Verifikation bestätigte die tatsächliche Auswirkung: Die `anon`-Rolle (der öffentliche API-Key, der im Frontend-Bundle sichtbar ist, siehe `docker-compose.yml`) hatte **volle SELECT/INSERT/UPDATE/DELETE/TRUNCATE-Rechte** auf beiden Tabellen, weil Row Level Security auf Tabellenebene deaktiviert war (`relrowsecurity = false`) — vorhandene Policies griffen dadurch gar nicht.

**Werkstatt-Vergleich:** Das Lager-Tor stand offen, obwohl Schlösser (Policies) montiert waren — die Schlösser waren einfach nicht scharf geschaltet.

**Nachgewiesen:** Ein Testabruf mit dem öffentlichen `anon`-Key lieferte echte Artikeldaten (Nummern, Beschreibungen, Verkaufspreise) ohne jede Anmeldung zurück.

---

## 2. Root-Cause

- RLS war für beide Tabellen nie mit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` aktiviert worden
- `anon` und `authenticated` hatten Standard-Postgres-Grants (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) aus der initialen Tabellenerstellung, ohne dass RLS das eingeschränkt hätte

---

## 3. Fix

Migration: `supabase/migrations/20260717120000_products_customer_groups_rls_fix.sql`

1. `REVOKE ALL` auf beiden Tabellen von `anon` (kein Anwendungsfall für anonymen Zugriff)
2. RLS aktiviert (`ENABLE ROW LEVEL SECURITY`)
3. Alte, wirkungslose Policies entfernt
4. Neue Policies nach bestehendem Muster (siehe PROJ-28 Hersteller-Migration):
   - **SELECT:** alle `authenticated` Nutzer
   - **INSERT/UPDATE/DELETE:** nur Nutzer mit Rolle `admin` (Status `aktiv`)
   - **ALL:** `service_role` (App-Backend, umgeht RLS wie vorgesehen)

**Live verifiziert nach Anwendung:**
- ❌ `anon`-Zugriff auf `tms.products` → `permission denied for table products`
- ❌ `anon`-Zugriff auf `tms.customer_groups` → `permission denied for table customer_groups`
- ✅ `service_role`-Zugriff (App-Backend) funktioniert weiterhin normal

---

## 4. Akzeptanzkriterien

- [x] RLS auf `tms.products` aktiviert
- [x] RLS auf `tms.customer_groups` aktiviert
- [x] `anon`-Zugriff auf beide Tabellen live getestet und bestätigt blockiert
- [x] `service_role`-Zugriff (App-Backend) weiterhin funktionsfähig (keine Regression)
- [ ] Restliche 122 Security-Advisor-Meldungen (u.a. `tms.partners`, `tms.partner_contacts`, `tms.partner_addresses`, `tms.partner_billing_settings`) noch nicht geprüft — separater Task empfohlen

---

## 5. Kontext — Wie der Zugriff zustande kam

Diese Session (Claude Code) hat in Absprache mit Jan Bernd vollen Datenbank-Zugriff erhalten (Service-Role-Key + eine `exec_sql`-Hilfsfunktion für DDL über die HTTPS-API). Details dazu in `MEMORY.md` unter "Claude Code — Voller DB-Zugriff (2026-07-17)". Dieser erweiterte Zugriff soll vor dem finalen Produktions-Go-Live wieder eingeschränkt werden.

---

## 6. Nächste Schritte (empfohlen, nicht Teil dieses Fixes)

1. Verbleibende Security-Advisor-Meldungen systematisch durchgehen (124 Security-Issues waren initial gemeldet)
2. Insbesondere `tms.partners`-Familie (partner_contacts, partner_addresses, partner_billing_settings) prüfen — Advisor deutete auf möglicherweise fehlkonfigurierte Policies hin
3. Performance-Hinweise (74 Stück) separat bewerten
