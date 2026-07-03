# PROJ-17 — Auftrags-Default: Architektur

## Status
**Architected — wartet auf Freigabe**

## 1. Datenbank-Schema (Migration)

### Neue Spalten in `tms.partner_order_defaults`

```sql
-- Migration: supabase/migrations/0003_partner_order_defaults_columns.sql
-- Beschreibung: Erweitert partner_order_defaults um Fahrer-Zuordnung und Abholzyklus

ALTER TABLE tms.partner_order_defaults
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_cycle_count INTEGER CHECK (pickup_cycle_count > 0 AND pickup_cycle_count <= 52);

CREATE INDEX IF NOT EXISTS idx_partner_order_defaults_driver_id
  ON tms.partner_order_defaults(driver_id);

COMMENT ON COLUMN tms.partner_order_defaults.driver_id IS 'Verknüpfter Fahrer (nur User mit Rolle fahrer)';
COMMENT ON COLUMN tms.partner_order_defaults.pickup_cycle_count IS 'Abholzyklus in Wochen (1 = jede Woche, 2 = alle 2 Wochen)';
```

### RLS-Policies für `partner_order_defaults`

```sql
-- Lesen: Alle authentifizierten User (Werker müssen Defaults sehen können)
CREATE POLICY "partner_order_defaults_select_all" ON tms.partner_order_defaults
  FOR SELECT TO authenticated USING (true);

-- Schreiben: Nur Admins (über Service-Role umgegangen, aber als Fallback)
CREATE POLICY "partner_order_defaults_admin_update" ON tms.partner_order_defaults
  FOR UPDATE TO authenticated USING (public.is_active_admin()) WITH CHECK (public.is_active_admin());

CREATE POLICY "partner_order_defaults_admin_insert" ON tms.partner_order_defaults
  FOR INSERT TO authenticated WITH CHECK (public.is_active_admin());
```

> **Hinweis:** Schreibzugriff läuft primär über Service-Role-Client (wie PROJ-14), da Frontend-Zugriff auf `public.profiles` für Fahrer-Lookup auch Service-Role braucht.

---

## 2. Backend (Server Actions)

### 2.1 Neue Action-Datei: `src/lib/actions/order-defaults.ts`

**Warum neue Datei?** `partners.ts` ist bereits 300+ Zeilen. Trennung nach Domain (Partner-Stammdaten vs. Auftrags-Defaults) verbessert Wartbarkeit.

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────

export type OrderDefault = {
  id: string;
  partner_id: string;
  inbound_type: string | null;
  outbound_type: string | null;
  pickup_delivery_status: string | null;
  driver_id: string | null;
  pickup_cycle_count: number | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DriverOption = {
  id: string;
  full_name: string;
  email: string;
};

export type OrderDefaultResult =
  | { ok: true; data: OrderDefault | null }
  | { ok: false; error: string };

// ─── Konstanten (aus Datenbank-Dump extrahiert) ──────────

export const INBOUND_OPTIONS = [
  "Eigenversand durch Kunde",
  "Abholservice durch Gudel Werkzeuge",
  "Bestellung über schärfen.de-Shop",
  "Persönliche Anlieferung durch Kunde",
  "Versand über schärfen.de-Versandbox",
] as const;

export const OUTBOUND_OPTIONS = [
  "Versenden",
  "Selbst Abholer",
  "Bringen",
] as const;

export const PICKUP_STATUS_OPTIONS = [
  "Anruf",
  "Automatisch",
] as const;

// ─── READ: Auftrags-Default für einen Kunden laden ───────

export async function getPartnerOrderDefault(
  partnerId: string,
): Promise<OrderDefaultResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("tms")
    .from("partner_order_defaults")
    .select("*")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (error) {
    console.error("[getPartnerOrderDefault]", error);
    return { ok: false, error: "Konnte Auftrags-Default nicht laden." };
  }

  return { ok: true, data: data as OrderDefault | null };
}

// ─── READ: Alle aktiven Fahrer laden ─────────────────────

export async function getDrivers(): Promise<
  { ok: true; data: DriverOption[] } | { ok: false; error: string }
> {
  const supabase = await createClient();

  // Service-Role-Client für profiles (RLS schränkt Auth-Zugriff ein)
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("status", "aktiv")
    .contains("roles", ["fahrer"]);

  if (error) {
    console.error("[getDrivers]", error);
    return { ok: false, error: "Konnte Fahrer nicht laden." };
  }

  const drivers: DriverOption[] = (data ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name || p.email || "Unbekannt",
    email: p.email || "",
  }));

  // Alphabetisch sortieren
  drivers.sort((a, b) => a.full_name.localeCompare(b.full_name));

  return { ok: true, data: drivers };
}

// ─── WRITE: Auftrags-Default erstellen/aktualisieren ─────

export async function upsertPartnerOrderDefault(
  partnerId: string,
  values: {
    inbound_type: string;
    outbound_type: string;
    pickup_delivery_status: string;
    driver_id?: string | null;
    pickup_cycle_count?: number | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Admin-Check auf Serverseite
  const supabase = await createClient();
  const { data: isAdmin, error: adminError } = await supabase.rpc("is_active_admin");

  if (adminError || !isAdmin) {
    return { ok: false, error: "Nur Admins dürfen Auftrags-Defaults bearbeiten." };
  }

  // Service-Role für Schreibzugriff (tms-Schema)
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const serviceClient = createAdminClient({ schema: "tms" });

  // Validierung: driver_id Pflicht bei bestimmten Kombinationen
  const needsDriver =
    values.inbound_type === "Abholservice durch Gudel Werkzeuge" ||
    values.outbound_type === "Bringen";

  if (needsDriver && !values.driver_id) {
    return { ok: false, error: "Fahrer ist bei Abholservice oder 'Bringen' erforderlich." };
  }

  // Prüfen ob Eintrag existiert
  const { data: existing } = await serviceClient
    .schema("tms")
    .from("partner_order_defaults")
    .select("id")
    .eq("partner_id", partnerId)
    .maybeSingle();

  const payload = {
    partner_id: partnerId,
    inbound_type: values.inbound_type,
    outbound_type: values.outbound_type,
    pickup_delivery_status: values.pickup_delivery_status,
    driver_id: values.driver_id || null,
    pickup_cycle_count: values.pickup_cycle_count || null,
  };

  let error;
  if (existing) {
    // Update
    ({ error } = await serviceClient
      .schema("tms")
      .from("partner_order_defaults")
      .update(payload)
      .eq("partner_id", partnerId));
  } else {
    // Insert
    ({ error } = await serviceClient
      .schema("tms")
      .from("partner_order_defaults")
      .insert(payload));
  }

  if (error) {
    console.error("[upsertPartnerOrderDefault]", error);
    return { ok: false, error: "Speichern fehlgeschlagen." };
  }

  revalidatePath(`/kunden/${partnerId}`);
  return { ok: true };
}
```

### 2.2 Service-Role Client (bereits vorhanden in PROJ-14)

Der Service-Role-Client existiert bereits als `createAdminClient` in `src/lib/supabase/admin.ts`:

```typescript
import { createAdminClient } from "@/lib/supabase/admin";

const serviceClient = createAdminClient({ schema: "tms" });
```

> **Wichtig:** `schema: "tms"` muss gesetzt werden, damit die Queries im `tms`-Schema laufen.

---

## 3. Frontend-Komponenten

### 3.1 Komponenten-Hierarchie

```
KundeDetailPage (page.tsx)
└── TabContainer (tab-container.tsx) [geändert: 4 Tabs statt 3]
    └── OrderDefaultsTab
        └── OrderDefaultsCard
            ├── Anzeige (Karten-Layout)
            └── [Admin-Only] Edit-Button → OrderDefaultsModal
                └── OrderDefaultsForm
                    ├── Select: inbound_type
                    ├── Select: outbound_type
                    ├── Select: driver_id (bedingt sichtbar)
                    ├── Input: pickup_cycle_count (Zahl)
                    ├── Select: pickup_delivery_status
                    └── Validierung + Submit
```

### 3.2 Dateien

| Datei | Status | Beschreibung |
|-------|--------|-------------|
| `src/app/kunden/[id]/page.tsx` | 🔧 Änderung | Tab „defaults" hinzufügen |
| `src/app/kunden/[id]/components/tab-container.tsx` | 🔧 Änderung | 4. Tab-Trigger + AnimatePresence |
| `src/app/kunden/[id]/components/order-defaults-card.tsx` | ➕ Neu | Anzeige + Edit-Button (Admin-only) |
| `src/app/kunden/[id]/components/order-defaults-modal.tsx` | ➕ Neu | Modal mit Formular |
| `src/app/kunden/[id]/components/order-defaults-form.tsx` | ➕ Neu | Formular mit Validierung |

### 3.3 UI/UX Details

**Anzeige-Karte:**
- 2-Spalten-Grid (Label | Wert)
- Fahrer-Zeile: nur anzeigen wenn `driver_id` gesetzt
- Abholzyklus-Zeile: nur anzeigen wenn `pickup_cycle_count` gesetzt
- Stift-Icon (Pencil) oben rechts, nur sichtbar wenn User Admin ist

**Modal:**
- Titel: „Auftrags-Default bearbeiten"
- shadcn/ui Komponenten: `Dialog`, `Select`, `Input`, `Label`, `Button`
- Driver-Select: dynamisch ein-/ausblenden basierend auf inbound/outbound
- Validierung: Real-time (onChange) + onSubmit
- Erfolg: Toast + Modal schließen + revalidate

### 3.4 Admin-Prüfung im Frontend

```typescript
// Im Server-Action-Wrapper (page.tsx oder eigene Komponente)
const { data: profile } = await supabase
  .from("profiles")
  .select("roles")
  .eq("id", userId)
  .single();

const isAdmin = profile?.roles?.includes("admin");
// Stift-Button nur rendern wenn isAdmin
```

> **Alternative:** Admin-Status über `is_active_admin()` RPC im Server Action prüfen und als Prop an Client weitergeben.

---

## 4. Datenfluss (Sequenzdiagramm)

```
User (Admin)        Frontend              Server Action              Supabase
    │                   │                        │                      │
    │── Klick Stift ───►│                        │                      │
    │                   │── openModal() ────────►│                      │
    │                   │◄── drivers[] ──────────│── getDrivers() ─────►│
    │                   │                      │◄── Fahrer-Liste ──────│
    │                   │                      │                      │
    │── Form ausfüllen ─┤                      │                      │
    │── Submit ─────────►│── upsertPartnerOrderDefault() ─────────────►│
    │                   │                      │  (Service-Role)      │
    │                   │◄── {ok:true} ────────│◄── INSERT/UPDATE ─────│
    │                   │                      │                      │
    │◄── Toast + Refresh│◄── revalidatePath() ─│                      │
```

---

## 5. Validierungs-Regeln

| Bedingung | Regel | Fehlermeldung |
|-----------|-------|---------------|
| `inbound_type` leer | Pflichtfeld | „Zugang ist erforderlich" |
| `outbound_type` leer | Pflichtfeld | „Rücksendung ist erforderlich" |
| `pickup_delivery_status` leer | Pflichtfeld | „Abholstatus ist erforderlich" |
| `inbound_type` = „Abholservice…" | `driver_id` Pflicht | „Fahrer ist bei Abholservice erforderlich" |
| `outbound_type` = „Bringen" | `driver_id` Pflicht | „Fahrer ist bei 'Bringen' erforderlich" |
| `pickup_cycle_count` | Optional, aber > 0 | „Abholzyklus muss mindestens 1 Woche sein" |
| `pickup_cycle_count` | Max 52 | „Abholzyklus darf nicht mehr als 52 Wochen sein" |

---

## 6. Fehlerbehandlung

| Szenario | Frontend-Verhalten |
|----------|-------------------|
| Kein Eintrag für Kunden | Leere Karte mit Platzhalter „—" anzeigen, Admin kann anlegen |
| Fahrer-Load fehlgeschlagen | Driver-Select deaktiviert, Fehlertext „Fahrer konnten nicht geladen werden" |
| Speichern fehlgeschlagen | Toast-Error, Modal bleibt offen, Formular behält Werte |
| Keine Admin-Rechte | Stift-Button nicht sichtbar (kein Fehler) |

---

## 7. Test-Strategie (QA)

### Unit-Tests (Vitest)
- `upsertPartnerOrderDefault` — Validierungslogik
- `getDrivers` — Filter auf Rolle "fahrer"

### E2E-Tests (Playwright)
- Tab ist sichtbar und klickbar
- Anzeige zeigt korrekte Werte aus DB
- Admin sieht Stift-Button, Nicht-Admin nicht
- Modal öffnet/speichert/schließt korrekt
- Validierung zeigt Fehler bei leerem Fahrer
- Neuanlage funktioniert für Kunden ohne Eintrag

---

## 8. Abhängigkeiten

- **PROJ-11** (Kundendetailseite) — Muss deployed sein
- **PROJ-14** (Service-Role Pattern) — `createServiceClient` muss existieren
- **shadcn/ui** — `Dialog`, `Select`, `Input`, `Label`, `Button`

---

## 9. Migrations-Reihenfolge

```
1. 0003_partner_order_defaults_columns.sql  (DB-Spalten)
2. 0003_partner_order_defaults_rls.sql      (RLS-Policies)
```

> Oder kombiniert in einer Datei, je nach Projekt-Konvention.

---

**Nächster Schritt nach Freigabe:** `/frontend` — Umsetzung der UI-Komponenten.
