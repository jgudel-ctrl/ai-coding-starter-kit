# PROJ-25: Architektur — Easybill Rabatte + Artikelstamm

> Erstellt: 2026-07-10 11:01 UTC  
> Status: In Progress

---

## Übersicht

Kompletter Import aus Easybill:
1. **Produktgruppen** (~40) — Referenz-Tabelle
2. **Kundengruppen** (~8) — Referenz-Tabelle
3. **Artikel** (~7.315) — Mit Preisen, Typ, Gruppe
4. **Kunden-Rabatte** (~886) — Verknüpfung Kunde + Gruppe

---

## Datenbank-Schema

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  position_groups    │     │     products         │     │  customer_groups    │
├─────────────────────┤     ├──────────────────────┤     ├─────────────────────┤
│ id (BIGINT, PK)     │◄────┤ group_id (FK)        │     │ id (BIGINT, PK)     │
│ number              │     │ id (BIGINT, PK)      │     │ number              │
│ name                │     │ number               │     │ name                │
│ display_name        │     │ description          │     │ display_name        │
│ description         │     │ type (SERVICE/PROD)  │     └─────────────────────┘
└─────────────────────┘     │ cost_price           │              ▲
                            │ sale_price           │              │
                            │ vat_percent          │              │
                            │ unit                 │              │
                            │ archived             │              │
                            │ manufacturer (manu)  │              │
                            │ category (manu)      │              │
                            │ raw_easybill_payload │              │
                            └──────────────────────┘              │
                                    ▲                               │
                                    │                               │
┌─────────────────────┐             │                               │
│      partners       │             │                               │
├─────────────────────┤             │                               │
│ id (UUID, PK)       │◄────────────┘                               │
│ easybill_id         │     ┌──────────────────────┐                │
│ easybill_group_id   │────►│ partner_discounts    │                │
│ ...                 │     ├──────────────────────┤                │
└─────────────────────┘     │ id (UUID, PK)        │                │
                            │ partner_id (FK)       │                │
                            │ position_group_id (FK)│────────────────┘
                            │ discount_percent      │
                            │ discount_type         │
                            │ raw_easybill_payload  │
                            └──────────────────────┘
```

### Tabellen

#### `position_groups`
- `id` BIGINT PK (Easybill ID)
- `number` TEXT — z.B. "W10"
- `name` TEXT — z.B. "Kreissägeblätter"
- `display_name` TEXT — z.B. "W10 - Kreissägeblätter"
- `description` TEXT
- `created_at`, `updated_at` TIMESTAMPTZ

#### `customer_groups`
- `id` BIGINT PK (Easybill ID)
- `number` TEXT — z.B. "KD0"
- `name` TEXT
- `display_name` TEXT
- `created_at` TIMESTAMPTZ

#### `products`
- `id` BIGINT PK (Easybill Position-ID)
- `number` TEXT — Artikelnummer z.B. "101002"
- `description` TEXT
- `type` TEXT — "SERVICE" oder "PRODUCT"
- `group_id` BIGINT FK → position_groups.id
- `cost_price` NUMERIC — Einkaufspreis in Cent
- `sale_price` NUMERIC — Verkaufspreis in Cent
- `vat_percent` NUMERIC
- `unit` TEXT
- `archived` BOOLEAN
- `note` TEXT
- `manufacturer` TEXT — **manuell ergänzbar**
- `category` TEXT — **manuell: "service" oder "trade"**
- `raw_easybill_payload` JSONB
- `created_at`, `updated_at` TIMESTAMPTZ

#### `partner_discounts`
- `id` UUID PK
- `partner_id` UUID FK → partners.id
- `easybill_discount_id` BIGINT
- `position_group_id` BIGINT FK → position_groups.id
- `discount_percent` NUMERIC
- `discount_type` TEXT — "PERCENT" oder "AMOUNT"
- `raw_easybill_payload` JSONB
- `created_at`, `updated_at` TIMESTAMPTZ
- **UNIQUE** (partner_id, position_group_id)

---

## API / Endpunkte

### Easybill API (lesend)

| Endpoint | Was | Anzahl | Zeit |
|----------|-----|--------|------|
| `GET /position-groups` | Produktgruppen | ~40 | 1 Sek |
| `GET /customer-groups` | Kundengruppen | ~8 | 1 Sek |
| `GET /positions?limit=1000` | Artikel (paginiert) | ~7.315 | ~8 Sek |
| `GET /discounts/position-group` | Rabatte | ~886 | 2 Sek |

**Rate-Limit:** 60 req/min → wir drosseln auf 1 req/sec = sicher

### Unsere API (schreibend)

| Funktion | Was |
|----------|-----|
| `importPositionGroups()` | Produktgruppen importieren |
| `importCustomerGroups()` | Kundengruppen importieren |
| `importProducts()` | Artikel importieren (Upsert) |
| `importPartnerDiscounts()` | Rabatte importieren |
| `syncAllEasybillData()` | Alle 4 Schritte sequentiell |

---

## Ablauf: Initial-Import

```
Schritt 1: Produktgruppen
  └─ Lade von Easybill
  └─ INSERT INTO position_groups (Voll-Replace)
  
Schritt 2: Kundengruppen
  └─ Lade von Easybill
  └─ INSERT INTO customer_groups (Voll-Replace)

Schritt 3: Artikel (~7.315)
  └─ Lade Seite 1..8 (je 1000/Seite)
  └─ Upsert: INSERT ON CONFLICT UPDATE
  └─ Rate-Limit: 1 Sek Pause zwischen Pages
  
Schritt 4: Rabatte (~886)
  └─ Lade von Easybill
  └─ Pro Kunde: DELETE old + INSERT new (Voll-Replace)
  └─ ODER: Upsert mit UNIQUE Constraint
```

**Gesamtdauer:** ~30-60 Sekunden

---

## Ablauf: Update (bei Änderung)

**Trigger:** Cronjob (stündlich, gleicher wie PROJ-24) oder Webhook

```
1. Produktgruppen prüfen — INSERT ON CONFLICT UPDATE
2. Kundengruppen prüfen — INSERT ON CONFLICT UPDATE
3. Artikel prüfen — INSERT ON CONFLICT UPDATE (nur geänderte)
4. Rabatte — Upsert (neue/ geänderte)
```

---

## UI

### Kundendetail — Neuer Tab "Rabatte"

```
┌─────────────────────────────────────────────────┐
│  Rabatte                                        │
├─────────────────────────────────────────────────┤
│  Produktgruppe              Rabatt              │
│  ─────────────────────────────────────────────  │
│  W10 - Kreissägeblätter     40%                 │
│  W11 - Schaftfräser         25%                 │
│  W12 - Bohrungsfräser       —                   │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

### Admin — Artikel-Übersicht (optional, später)

Filter: Hersteller, Kategorie, Produktgruppe

---

## Technische Entscheidungen

| Entscheidung | Warum |
|--------------|-------|
| `products.id` = Easybill ID | Eindeutig, kein UUID nötig |
| Upsert statt Voll-Replace bei Artikeln | Schneller, nur Änderungen |
| Voll-Replace bei Rabatten | Pro Kunde komplett neu = sicherer |
| `manufacturer` + `category` nullable | Manuell ergänzbar später |
| Preise in Cent (NUMERIC) | Kein FLOAT-Rounding, exakt |
| JSONB für `raw_easybill_payload` | Flexibel, falls Easybill Felder ändert |

---

## Risiken

| Risiko | Abschwächung |
|--------|-------------|
| 7.315 Artikel = viele DB-Rows | Batch INSERT, 1000/Stück |
| API-Rate-Limit | 1 Sek Pause zwischen Requests |
| Duplikate bei Rabatten | UNIQUE Constraint (partner_id, group_id) |
| Hersteller fehlt in Easybill | Manuell ergänzbar, nullable |

---

## Nächste Schritte

1. ✅ Spec approved
2. ✅ Architektur erstellt (dieses Dokument)
3. 🔄 **Jetzt:** Jan Bernd reviewt Architektur → "approved"
4. Dann: Datenbank-Tabellen anlegen
5. Dann: Initial-Import Script bauen
6. Dann: UI (Rabatte-Tab) bauen

---

*Erstellt: 2026-07-10 11:01 UTC*
