# PROJ-17 — Auftrags-Default im Kunden-Detail

## Status
**Deployed ✅** (2026-07-03)

## Zusammenfassung (1 Satz)
Neuer Tab „Auftrags-Default" auf der Kundendetailseite, der pro Kunden die Standard-Einstellungen für Aufträge anzeigt und für Admins bearbeitbar macht: Wie kommt Werkzeug zu uns, wie wird es zurückgesendet, wer ist der Fahrer, wie oft wird abgeholt.

## Problem & Motivation
Aktuell sind die Auftrags-Defaults pro Kunde in der Datenbank gespeichert, aber nirgendwo in der App sichtbar. Das bedeutet:
- Werker müssen auswendig wissen, ob ein Kunde Abholservice hat oder selbst versendet.
- Fahrer-Zuordnungen sind nicht nachvollziehbar.
- Änderungen müssen direkt in der Datenbank gemacht werden.

## Akzeptanzkriterien (Checkliste)

- [ ] **Neuer Tab** „Auftrags-Default" in der Kundendetailseite (neben Übersicht / Umsatz / Bestellhistorie)
- [ ] **Anzeige** der folgenden Felder in einer übersichtlichen Karte:
  - **Zugang / inbound_type:** Wie kommt das Werkzeug zu uns?
  - **Rücksendung / outbound_type:** Wie wird es zurückgeschickt?
  - **Fahrer / driver_id:** Wer holt ab oder bringt zurück? *(nur sichtbar wenn Zugang = „Abholservice…" oder Rücksendung = „Bringen")*
  - **Abholzyklus / pickup_cycle_count:** Abholzyklus in **Wochen** (z.B. 1 = jede Woche, 2 = alle 2 Wochen)
  - **Abholstatus / pickup_delivery_status:** „Anruf" oder „Automatisch"
- [ ] **Bearbeitbar** über ein Stift-Icon → Modal (nur sichtbar für User mit Admin-Rolle)
- [ ] **Dropdown-Regeln:**
  - `inbound_type`: „Eigenversand durch Kunde", „Abholservice durch Gudel Werkzeuge", „Bestellung über schärfen.de-Shop", „Persönliche Anlieferung durch Kunde", „Versand über schärfen.de-Versandbox"
  - `outbound_type`: „Bringen", „Selbst Abholer", „Versenden"
  - `pickup_delivery_status`: „Anruf", „Automatisch"
  - `driver_id`: Alle aktiven User mit Rolle `'fahrer'` aus `public.profiles`
- [ ] **Validierung:**
  - Wenn `inbound_type` = „Abholservice durch Gudel Werkzeuge" → `driver_id` ist Pflichtfeld
  - Wenn `outbound_type` = „Bringen" → `driver_id` ist Pflichtfeld
- [ ] **Speichern** über Server-Action mit Service-Role (RLS-Umgehung, siehe PROJ-14-Pattern)
- [ ] **Neuanlage:** Falls für einen Kunden noch kein Eintrag in `partner_order_defaults` existiert, wird beim ersten Speichern automatisch einer erstellt
- [ ] **Berechtigung:** Bearbeiten-Button und Speichern nur für Admins (`public.is_active_admin()` oder Frontend-Check auf Admin-Rolle)
- [ ] **Responsive:** Mobile-optimierte Darstellung

## Datenbank-Änderungen (Migration)

```sql
-- 1) Neue Spalten in tms.partner_order_defaults
ALTER TABLE tms.partner_order_defaults
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_cycle_count INTEGER;

-- 2) Index für Fahrer-Lookups
CREATE INDEX IF NOT EXISTS idx_partner_order_defaults_driver_id
  ON tms.partner_order_defaults(driver_id);
```

## UI/UX Skizze (Karten-Layout)

```
┌──────────────────────────────────────────────┐
│  📋 Auftrags-Default              [✏️ Admin] │
├──────────────────────────────────────────────┤
│  Zugang (inbound)         Eigenversand durch Kunde  │
│  Rücksendung (outbound)   Versenden                │
│  Fahrer                   —                          │
│  Abholzyklus              —                          │
│  Abholstatus              Anruf                    │
└──────────────────────────────────────────────┘
```

Bearbeiten öffnet ein Modal mit Select-Dropdowns (shadcn/ui `Select`).

## Nicht im Scope
- Keine Historie/Log der Änderungen
- Keine Massenbearbeitung (nur pro Kunde einzeln)
- Keine zusätzlichen Zugangsarten (nur die 5 bestehenden)

## Offene Fragen / Entscheidungen

| Frage | Status | Antwort |
|-------|--------|---------|
| `pickup_cycle_count` → Einheit? | ✅ geklärt | **Wochen** — z.B. 1 = jede Woche, 2 = alle 2 Wochen |
| Edit-Modal oder Inline-Edit? | ✅ geklärt | Modal (konsistent mit Adressen/Kontakten) |
| Wer darf bearbeiten? | ✅ geklärt | **Nur Admins** — Bearbeiten-Button nur für Admin-Rolle sichtbar |
| Soll ein Fahrer-Icon neben dem Namen stehen? | 🟡 offen | Nice-to-have, nicht MVP |

## Verwandte Features
- PROJ-11 (Kundendetailseite) — erweitert die bestehende Tab-Struktur
- PROJ-14 (RLS-Fix mit Service-Role) — gleiches Pattern für DB-Zugriff

## Dateien (vermutet)
- `src/app/kunden/[id]/page.tsx` — Tab „defaults" hinzufügen
- `src/app/kunden/[id]/components/tab-container.tsx` — 4. Tab-Trigger
- `src/app/kunden/[id]/components/order-defaults-card.tsx` — NEU: Anzeige + Edit
- `src/lib/actions/partners.ts` — NEU: `getPartnerOrderDefaults`, `updatePartnerOrderDefaults`
- `supabase/migrations/0003_partner_order_defaults_columns.sql` — NEU: Migration

---

**Nächster Schritt nach Freigabe:** `/architecture` — technische Architektur für Frontend-Tab, Server-Actions und DB-Migration.
