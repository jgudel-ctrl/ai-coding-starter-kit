# BUG-2: Bestellhistorie zeigt keine Daten

**Status:** Deployed ✅ (2026-07-02)  
**Erstellt:** 2026-07-02  
**Reporter:** Jan Bernd Gudel  
**Betrifft:** PROJ-11 Kundendetailseite (erweitert)

---

## Problem

In der Kundendetailseite unter Tab "Bestellhistorie" werden keine Bestellungen angezeigt — trotz vorhandener Daten. Die Tabelle bleibt leer mit der Meldung "Keine Bestellungen gefunden".

## Ursache

`src/lib/actions/orders.ts` verwendet den normalen Supabase-Client (`createClient` aus `@/lib/supabase/server`), der mit dem Anon-Key arbeitet. Die Datenbank hat Row-Level Security (RLS) auf den Tabellen `invoice_items` und `invoices`. Da der Anon-Key keine Berechtigung hat, werden die Daten blockiert.

Dies ist das **gleiche Problem**, das bereits in PROJ-14 bei den Umsätzen behoben wurde (dort wurde auf `createAdminClient` umgestellt).

**Zusätzliches Problem:** Die Count-Query wird zwar definiert, aber nie ausgeführt (`countQuery` wird gebaut, nicht abgefeuert). Dadurch ist `totalCount` immer 0 und die Seitennummerierung taucht nie auf.

## Betroffene Dateien

- `src/lib/actions/orders.ts` — Import + Query-Logik

## Lösung

1. Import von `createClient` ändern zu `createAdminClient` aus `@/lib/supabase/admin`
2. `count: "exact"` zur Haupt-Query hinzufügen, damit die Gesamtanzahl korrekt zurückkommt
3. Die separate `countQuery` entfernen (unnötig, da `count: "exact"` direkt in der Haupt-Query funktioniert)

## Änderungen

### `src/lib/actions/orders.ts`

```diff
-import { createClient } from "@/lib/supabase/server";
+import { createAdminClient } from "@/lib/supabase/admin";
```

```diff
-    const supabase = await createClient();
+    const supabase = createAdminClient({ schema: "tms" });
```

```diff
-    // Zuerst die Gesamtanzahl ermitteln
-    let countQuery = supabase
-      .from("invoice_items")
-      .select("id", { count: "exact", head: true })
-      .eq("revenue_category", "trade")
-      .not("title", "is", null);
-
-    // Dann die Daten abrufen (mit Join über invoice_id)
     let query = supabase
       .from("invoice_items")
       .select(
         `
         title,
         item_number,
         quantity,
         unit_price,
         discount,
         total_price,
         cost_price,
         invoices!inner(document_date, document_number, partner_id)
       `
       )
       .eq("invoices.partner_id", partnerId)
       .eq("revenue_category", "trade")
       .not("title", "is", null)
       .order("invoices(document_date)", { ascending: false })
+      .select("*", { count: "exact" })
       .range((page - 1) * pageSize, page * pageSize - 1);
```

## Akzeptanzkriterien

- [ ] Bestellhistorie zeigt tatsächliche Bestelldaten für Kunden mit Handelsware-Umsätzen
- [ ] Seitennummerierung erscheint, wenn mehr als 20 Einträge vorhanden
- [ ] Suche nach Artikel oder Artikelnummer funktioniert weiterhin
- [ ] Keine neuen Fehler oder Warnungen in der Konsole

## Impact

**Nutzer-Auswirkung:** Der Kunde (z.B. Fietz GmbH) sieht jetzt tatsächlich seine Bestellhistorie mit Artikeln, Preisen und Mengen. Bisher war der Tab nutzlos.
