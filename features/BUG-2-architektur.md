# BUG-2: Bestellhistorie zeigt keine Daten — Architektur

## Kontext

Gleicher Bug wie PROJ-14: `src/lib/actions/orders.ts` verwendet den normalen Cookie-basierten Supabase-Client (`createClient`), der mit dem Anon-Key arbeitet. Die Tabellen `invoice_items` und `invoices` haben RLS-Policies, die Anon-Key-Zugriff blockieren.

In PROJ-14 wurde `revenue.ts` bereits auf `createAdminClient` umgestellt — gleiche Lösung hier.

## Änderungen

### `src/lib/actions/orders.ts`

| Zeile | Vorher | Nachher |
|-------|--------|---------|
| Import | `import { createClient } from "@/lib/supabase/server";` | `import { createAdminClient } from "@/lib/supabase/admin";` |
| Client-Erzeugung | `const supabase = await createClient();` | `const supabase = createAdminClient({ schema: "tms" });` |
| Count | Separate `countQuery`, nie ausgeführt | `.select("*", { count: "exact" })` in Haupt-Query |

## Tech-Stack

- Bestehend: Next.js Server Action (`"use server"`)
- Bestehend: Supabase Admin-Client (`@/lib/supabase/admin`)
- Schema: `tms` (wie bei `revenue.ts`)

## Sicherheit

- `createAdminClient` umgeht RLS — korrekt für Server Actions, wo kein eingeloggter Nutzer direkt zugreift
- NIE im Browser-Code verwenden (bereits durch `"use server"` garantiert)
- Service-Role-Key ist server-seitig via ENV (`SUPABASE_SERVICE_ROLE_KEY`)

## Impact

- **Keine UI-Änderungen** — nur Daten-Layer-Fix
- **Keine neuen Abhängigkeiten**
- **Keine DB-Schema-Änderungen**

## QA-Hinweis

- Kundendetailseite → Tab "Bestellhistorie" → Daten sollten jetzt erscheinen
- Seitennummerierung testen, wenn >20 Einträge
