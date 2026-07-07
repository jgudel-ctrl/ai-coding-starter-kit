# PROJ-11: Architektur — Kundendetailseite (erweitert)

**Status:** Approved → Architektur geschrieben  
**Datum:** 2026-07-02

---

## 1. Zusammenfassung

Die existierende Kundendetailseite (`/kunden/[id]`) wird zu einer **modernen, tabbasierten Ansicht** mit Bento Grid, Animationen und erweiterten Daten erweitert.

**Was kommt neu:**
- Tabs: Übersicht | Umsatz | Bestellhistorie
- Adressen editierbar (Modal → Supabase Update)
- Umsatz-Balkendiagramm mit Jahres-Switch (Recharts)
- Bestellhistorie (NUR Trade Goods aus `invoice_items`)
- Kontaktliste mit "+"-Button (Modal → Supabase Insert)
- Framer Motion für Animationen (Tabs, Modals, Bento Grid)

---

## 2. Datenbank-Schema (Bestehend)

### `tms.partners` — Stammdaten
```sql
- id (uuid, PK)
- partner_number (text)
- company_name, display_name
- first_name, last_name
- email, phone, mobile, website
- vat_identifier, tax_number
- is_active, is_archived
```

### `tms.partner_addresses` — Adressen
```sql
- id (uuid, PK)
- partner_id (uuid, FK → partners)
- address_type (text: 'billing', 'shipping', 'pickup', 'delivery')
- is_default (boolean)
- company_name, first_name, last_name
- street, additional_line
- postal_code, city, state, country
- easybill_address_source (text)
```

### `tms.partner_contacts` — Kontakte
```sql
- id (uuid, PK)
- partner_id (uuid, FK → partners)
- display_name, first_name, last_name
- email, phone, mobile
- role (text: Position in der Firma)
- notes (text)
- is_primary (boolean)
- created_at, updated_at
```

### `tms.mv_partner_monthly_revenue` — Materialized View (bereits berechnet!)
```sql
- partner_id (uuid)
- year (integer)
- month (integer)
- revenue_total (numeric)
- revenue_service (numeric)
- revenue_retail (numeric) -- Handelsware
- revenue_custom (numeric) -- Sonderwerkzeug
- revenue_shipping (numeric)
- gross_profit_service (numeric)
- gross_profit_trade (numeric)
- gross_profit_custom (numeric)
- gross_profit_shipping (numeric)
- gross_profit (numeric)
- cost_total (numeric)
- margin_percent (numeric)
- invoice_count (integer)
- item_count (integer)
- calculated_at (timestamp)
```

### `tms.invoices` — Rechnungen
```sql
- id (uuid, PK)
- partner_id (uuid, FK)
- easybill_document_id (bigint)
- document_number (text)
- document_type (text)
- document_date (date)
- status (text)
- net_amount, gross_amount, amount, amount_net
```

### `tms.invoice_items` — Rechnungspositionen
```sql
- id (uuid, PK)
- invoice_id (uuid, FK)
- easybill_item_id (bigint)
- title, description, item_number
- quantity (numeric)
- unit_price, total_price, discount (numeric)
- cost_price (numeric) -- EK-Preis
- revenue_category (text: 'service', 'trade', 'custom', 'shipping')
- item_type (text)
- position (integer)
```

---

## 3. Datenfluss (Server Actions)

### Action: `getPartnerById(id)` — Bereits vorhanden
```typescript
// src/lib/actions/partners.ts
export async function getPartnerById(id: string) {
  // 1. Partner aus tms.partners
  // 2. Adressen aus tms.partner_addresses (alle Typen)
  // 3. Kontakte aus tms.partner_contacts
  return { partner, addresses, contacts }
}
```

### Action: `updatePartnerAddress(addressId, data)` — NEU
```typescript
// src/lib/actions/addresses.ts
export async function updatePartnerAddress(
  addressId: string,
  data: AddressUpdateInput
) {
  // 1. Prüfe Rechte (Admin/AV)
  // 2. UPDATE tms.partner_addresses SET ... WHERE id = addressId
  // 3. Revalidate Path /kunden/[id]
  // 4. Return { ok: true } | { ok: false, error }
}
```

### Action: `getPartnerRevenue(partnerId, year)` — NEU
```typescript
// src/lib/actions/revenue.ts
export async function getPartnerRevenue(
  partnerId: string,
  year: number
) {
  // 1. SELECT * FROM tms.mv_partner_monthly_revenue
  //    WHERE partner_id = :id AND year = :year
  //    ORDER BY month ASC
  // 2. Berechne Summen pro Kategorie
  // 3. Return Array<MonthlyRevenue>
}
```

### Action: `getPartnerTradeOrders(partnerId, filters)` — NEU
```typescript
// src/lib/actions/orders.ts
export async function getPartnerTradeOrders(
  partnerId: string,
  filters: { dateFrom?, dateTo?, search? }
) {
  // 1. SELECT ii.*, i.document_date, i.document_number
  //    FROM tms.invoice_items ii
  //    JOIN tms.invoices i ON ii.invoice_id = i.id
  //    WHERE i.partner_id = :id
  //      AND ii.revenue_category = 'trade'  // ← WICHTIG: NUR Handelsware!
  //    ORDER BY i.document_date DESC
  // 2. Filter nach Zeitraum + Suche
  // 3. Paginierung: LIMIT 20 OFFSET :offset
  // 4. Return { items, totalCount }
}
```

### Action: `getPartnerContacts(partnerId)` — NEU
```typescript
// src/lib/actions/contacts.ts
export async function getPartnerContacts(partnerId: string) {
  // SELECT * FROM tms.partner_contacts
  // WHERE partner_id = :id
  // ORDER BY is_primary DESC, created_at DESC
}
```

### Action: `createPartnerContact(partnerId, data)` — NEU
```typescript
// src/lib/actions/contacts.ts
export async function createPartnerContact(
  partnerId: string,
  data: ContactCreateInput
) {
  // 1. Prüfe Rechte (Admin/AV)
  // 2. INSERT INTO tms.partner_contacts
  // 3. Revalidate Path /kunden/[id]
  // 4. Return { ok: true, contact } | { ok: false, error }
}
```

---

## 4. Komponenten-Struktur

### Haupt-Seite
```
src/app/kunden/[id]/page.tsx
  → KundendetailPage (Server Component)
    → TabsContainer (Client Component)
      → Tab: Übersicht
        → CustomerHeader (Server)
        → BentoGrid (Client)
          → StammdatenCard
          → AddressCard (billing) + AddressCard (shipping)
            → AddressEditModal (Dialog)
          → ContactsList
            → ContactAddModal (Dialog)
      → Tab: Umsatz
        → RevenueChart (Client, Recharts)
          → RevenueYearSelector (Select)
        → RevenueSummaryCard
      → Tab: Bestellhistorie
        → OrderHistoryTable (Client)
          → OrderHistoryFilters
          → Pagination
```

### Shared Components
```
src/components/ui/
  tabs.tsx        → Bereits vorhanden (shadcn)
  dialog.tsx      → Bereits vorhanden (shadcn)
  select.tsx      → Bereits vorhanden (shadcn)
  table.tsx       → Bereits vorhanden (shadcn)
  card.tsx        → Bereits vorhanden (shadcn)
  button.tsx      → Bereits vorhanden (shadcn)
  input.tsx       → Bereits vorhanden (shadcn)
  label.tsx       → Bereits vorhanden (shadcn)
  textarea.tsx    → Bereits vorhanden (shadcn)
```

---

## 5. UI/UX Design-Entscheidungen

### Bento Grid Layout (Desktop)
```
┌─────────────────┬──────────────┬──────────────┐
│                 │              │              │
│  Stammdaten     │ Rechnungs-   │  Liefer-     │
│  (breit)        │ adresse      │  adresse     │
│                 │              │              │
├─────────────────┴──────────────┴──────────────┤
│  Kontaktliste (+ Button)                      │
└───────────────────────────────────────────────┘
```

### Tabs mit Animationen (Framer Motion)
- **Tab-Wechsel:** Fade-In + Slide (0.2s, ease-out)
- **Modal-Öffnung:** Scale from 0.95 → 1.0 + Opacity 0 → 1
- **Bento Grid Karten:** Hover-Effekt (leichter Scale + Shadow)
- **Loading:** Skeleton-Shimmer-Effekt

### Responsive Breakpoints
- **Desktop (>1024px):** Bento Grid mit 3 Spalten
- **Tablet (768–1024px):** Bento Grid mit 2 Spalten
- **Mobile (<768px):** Einspaltig, Tabs horizontal scrollbar

---

## 6. State-Management

### Server-Side (Next.js Server Components)
- Alle Daten-Fetching via Server Actions
- Kein `useState` für Daten auf Seitenebene
- Revalidation nach Updates via `revalidatePath()`

### Client-Side (wo nötig)
- **Tabs:** `useState` für aktiver Tab-Index
- **Modals:** `useState` für open/close
- **Formulare:** `useState` für Form-Input
- **Filter Bestellhistorie:** `useState` für Filter + `useEffect` für Data-Fetching
- **Jahres-Switch:** `useState` für ausgewähltes Jahr

---

## 7. Animationen (Framer Motion)

```typescript
// Tabs-Container
const tabVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } }
}

// Modal
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.15 } }
}

// Bento Card Hover
const cardHover = {
  scale: 1.02,
  boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  transition: { duration: 0.2 }
}
```

---

## 8. Security & RLS

### Bereits konfiguriert (via bestehende Migrationen):
- `tms.partners` → SELECT für alle authentifizierten Nutzer
- `tms.partner_addresses` → SELECT für alle
- `tms.partner_contacts` → SELECT für alle

### NEU zu konfigurieren:
```sql
-- Adressen bearbeiten: Nur Admin/AV
CREATE POLICY "Admin kann Adressen bearbeiten" ON tms.partner_addresses
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Admin', 'Arbeitsvorbereitung')
  )
);

-- Kontakte anlegen: Nur Admin/AV
CREATE POLICY "Admin kann Kontakte anlegen" ON tms.partner_contacts
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND r.name IN ('Admin', 'Arbeitsvorbereitung')
  )
);
```

---

## 9. Performance

### Optimierungen:
1. **Materialized View** `mv_partner_monthly_revenue` → Keine Berechnung zur Laufzeit
2. **Pagination** Bestellhistorie → 20 Items pro Seite
3. **Lazy Loading** → Tabs laden Daten erst bei Aktivierung
4. **Revalidate** → Nach Updates kein Full-Reload

### Potenzielle Bottlenecks:
- **Bestellhistorie mit vielen Items** → Pagination + Index auf `invoices.partner_id`
- **Umsatz über mehrere Jahre** → Nur ein Jahr zur Zeit laden

---

## 10. Dateien-Liste

### Neue Dateien:
```
src/
  app/kunden/[id]/
    page.tsx                         # Refactored: Tabs + Bento Grid
    components/
      customer-header.tsx              # Kopfzeile mit Name + Status
      address-card.tsx               # Adress-Karte mit Edit-Button
      address-edit-modal.tsx         # Modal für Adress-Edit
      contacts-list.tsx              # Kontaktliste mit "+" Button
      contact-add-modal.tsx          # Modal für neuen Kontakt
      revenue-chart.tsx              # Balkendiagramm (Recharts)
      revenue-year-selector.tsx      # Jahres-Dropdown
      revenue-summary.tsx            # Summen-Karte
      order-history-table.tsx        # Bestellhistorie-Tabelle
      order-history-filters.tsx      # Filter + Suche
      tab-container.tsx              # Tabs mit Framer Motion
      bento-grid.tsx                 # Bento Grid Layout
  lib/
    actions/
      addresses.ts                   # updatePartnerAddress
      contacts.ts                    # getPartnerContacts, createPartnerContact
      revenue.ts                     # getPartnerRevenue
      orders.ts                      # getPartnerTradeOrders
```

### Bestehende Dateien (keine Änderung):
```
src/app/kunden/[id]/page.tsx        # Wird ersetzt/refactored
src/lib/actions/partners.ts         # Bleibt bestehen
```

### Neue Dependencies:
```bash
npm install framer-motion recharts
```

---

## 11. Build & Deploy

```bash
# 1. Dependencies installieren
npm install framer-motion recharts

# 2. Build testen
npm run build

# 3. Lint check
npm run lint

# 4. Deploy
# → Docker Compose auf Server
```

---

*Architektur approved → Bereit für Frontend/Backend*
