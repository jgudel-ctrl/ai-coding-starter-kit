# PROJ-14: Architektur — Umsätze + Service-Icon fix

## Status: Draft
## Author: Klausi
## Date: 2026-07-02

---

## Analyse der Fehlerursachen

### Bug 1: Umsätze leer

**Was passiert:**
- Die `revenue.ts` nutzt `createClient()` (Anon-Key + Cookie-Session)
- Supabase's PostgREST gibt "Unauthorized" zurück, wenn man Materialized Views mit Anon-Key abfragt
- Die Materialized View `mv_partner_monthly_revenue` hat keine RLS (PostgreSQL-Views haben kein RLS-Konzept)
- Die Basis-Tabellen `invoice_items` und `invoices` haben ebenfalls KEINE RLS (gesehen: `rowsecurity = f`)
- Nur `partners` hat RLS (`rowsecurity = t`) — die Partnerdaten sind geschützt

**Warum es früher ging und jetzt nicht mehr:**
- Die Materialized View wurde erst nach PROJ-11 erstellt (oder die RLS auf `partners` hat den indirekten Zugriff blockiert)
- Derzeit kommt kein einziges Byte an die App

### Bug 2: Falsches Icon

- `Receipt` (Dollar-Zeichen) wird für Service verwendet
- Soll: `Wrench` (Schraubenschlüssel)
- 1-Zeilen-Änderung in `revenue-summary.tsx`

---

## Lösungsoptionen für Bug 1

### Option A: Service-Role-Client in `revenue.ts` (Empfohlen ✓)

**Wie:** `createAdminClient()` statt `createClient()` nutzen

**Vorteile:**
- Minimaler Code-Change (1 Zeile)
- Keine Datenbank-Änderung notwendig
- Read-only Zugriff auf aggregierte Daten → kein Sicherheitsrisiko
- Die Partnerdaten sind weiterhin über `partners` RLS geschützt

**Nachteile:**
- Umgeht RLS (aber nur für aggregierte Read-Only-Daten)

### Option B: RPC-Funktion mit SECURITY DEFINER

**Wie:** Neue PostgreSQL-Funktion erstellen, die als Admin läuft

**Vorteile:**
- Sauberer Architektur
- Kein Service-Role-Client in der App

**Nachteile:**
- Erfordert Datenbank-Migration
- Mehr Code
- Überkompliziert für einen Bugfix

### Option C: RLS auf Materialized View

**Wie:** `ALTER VIEW ... ENABLE ROW LEVEL SECURITY` — geht in PostgreSQL nicht für Views

**Ergebnis:** Nicht möglich

---

## Empfohlene Architektur

**Option A** — Service-Role-Client in `revenue.ts` verwenden.

### Änderungen:

```typescript
// revenue.ts
import { createAdminClient } from "@/lib/supabase/admin"; // NEU

export async function getPartnerRevenue(partnerId: string, year: number) {
  // ALT: const supabase = await createClient();
  const supabase = createAdminClient(); // NEU
  // ... rest bleibt gleich
}

export async function getAvailableRevenueYears(partnerId: string) {
  // ALT: const supabase = await createClient();
  const supabase = createAdminClient(); // NEU
  // ... rest bleibt gleich
}
```

```typescript
// revenue-summary.tsx
// ALT: import { TrendingUp, Receipt, Package } from "lucide-react";
import { TrendingUp, Receipt, Package, Wrench } from "lucide-react"; // NEU

// In der cards-Array:
// ALT: icon: Receipt,
// NEU: icon: Wrench,
```

---

## Datenfluss nach dem Fix

```
Browser → Next.js App → Server Action (revenue.ts)
                              ↓
                     createAdminClient()
                              ↓
                     Service-Role-Key (bypass RLS)
                              ↓
                     Supabase → mv_partner_monthly_revenue
                              ↓
                     Aggregierte Umsatzdaten
                              ↓
                     Chart + Summary-Karten
```

---

## Sicherheit

- **Kein Datenleck:** Der Service-Role-Client ist read-only auf aggregierte Daten
- **Partner-Daten weiter geschützt:** `partners` Tabelle hat weiterhin RLS
- **Keine Einzel-Rechnungspositionen sichtbar:** Die View zeigt nur Monats-Summen
- **Audit-Trail:** Keine sensiblen Daten werden preisgegeben

---

## Keine neuen Abhängigkeiten

- Keine neuen Packages
- Keine neuen Datenbank-Spalten
- Keine neuen API-Endpunkte
- Bestehende UI-Komponenten bleiben unverändert

---

## Commit-Message

```
fix(PROJ-14): Umsatzdaten via Service-Role-Client abfragen + Service-Icon

- revenue.ts: createClient() → createAdminClient() für mv_partner_monthly_revenue
- revenue-summary.tsx: Service-Icon Receipt → Wrench
```
