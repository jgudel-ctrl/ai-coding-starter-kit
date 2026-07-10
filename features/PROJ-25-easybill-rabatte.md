# PROJ-25: Easybill Rabatte + Artikelstamm (komplett)

> Status: ✅ Deployed | 2026-07-10 11:21 UTC  
> Verantwortlich: Jan Bernd Gudel / Klausi  
> Priorität: Mittel

---

## Projekt-Info

- **Status:** Deployed ✅ (2026-07-10)
- **Import-Ergebnis:** 40 Produktgruppen + 8 Kundengruppen + 7.315 Artikel + 886 Rabatte (15.6 Sekunden)
- **UI:** Rabatte-Tab auf Kundendetailseite (`/kunden/[id]`)
- **Script:** `scripts/import-easybill-products.js`
- **Architektur:** `features/PROJ-25-architektur.md`

---

## Ergebnis

✅ **Deployed am 2026-07-10 um 11:21 UTC**

| Daten | Anzahl | Status |
|-------|--------|--------|
| Produktgruppen | 40 | ✅ Importiert |
| Kundengruppen | 8 | ✅ Importiert |
| Artikel | 7.315 | ✅ Importiert |
| Rabatte | 886 | ✅ Importiert |
| Dauer | 15.6s | ✅ |

**UI:** Rabatte-Tab auf Kundendetailseite zeigt pro Kunde:
- Produktgruppen-Name + Nummer
- Rabatt-Prozentsatz (farblich: >20% rot, >10% orange, sonst grau)
- Höchster Rabatt + Durchschnitt

**Dateien:**
- `scripts/import-easybill-products.js` — Import-Script
- `src/lib/actions/discounts.ts` — Server Action
- `src/app/(app)/kunden/[id]/components/discounts-card.tsx` — UI
- `features/PROJ-25-architektur.md` — Architektur

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Aus Easybill importieren wir nicht nur die Kunden-Rabatte, sondern auch den **kompletten Artikelstamm** (~7.300 Artikel). Das ermöglicht später:
- Rabatte pro Kunde und Produktgruppe anzeigen
- Artikel klassifizieren (Service vs. Handelsware)
- Einkaufs- und Verkaufspreise vergleichen
- Hersteller hinterlegen (manuell ergänzbar)

**Was Jan Bernd dadurch erreicht:**
- **Transparenz:** Welcher Kunde bekommt wie viel Rabatt auf welche Produktgruppe?
- **Preiskontrolle:** Einkaufspreis vs. Verkaufspreis auf einen Blick
- **Grundlage für Rechnungen:** Artikeldaten direkt im TMS verfügbar
- **Service/Handels-Trennung:** Spätere Auswertung nach Artikeltyp möglich

---

## IST-Analyse: Daten in Easybill

### 1. Produktgruppen (Position Groups) — ~40 Stück

| Feld | Beispiel |
|------|----------|
| ID | 92477 |
| Nummer | W10 |
| Name | Kreissägeblätter |
| Beschreibung | HW-Sägeblätter, HSS-Sägeblätter... |

### 2. Kundengruppen (Customer Groups) — ~8 Stück

| Feld | Beispiel |
|------|----------|
| ID | 102688 |
| Nummer | KD0 |
| Name | Kunden ohne Zuordnung |

### 3. Artikel (Positions) — ~7.315 Stück

```json
{
  "id": 199691468,
  "number": "101002",
  "description": "HW-Sägeblatt geschärft bis Z100",
  "type": "SERVICE",           // "SERVICE" oder "PRODUCT"
  "group_id": 92522,           // → Produktgruppe
  "cost_price": 0,              // Einkaufspreis (Cent)
  "sale_price": 3816,          // Verkaufspreis (Cent = €38,16)
  "vat_percent": 19,
  "unit": "",
  "archived": false,
  "note": "Gudel Werkzeuge"
}
```

**Wichtig:** `type: "SERVICE"` vs `"PRODUCT"` — das könnte direkt die Service/Handels-Klassifizierung sein. Müssen wir prüfen, ob das so stimmt.

### 4. Kunden-Rabatte (Position-Group Discounts) — ~886 Stück

```json
{
  "id": 283442,
  "customer_id": 688115002,      // → Kunde
  "position_group_id": 92522,   // → Produktgruppe
  "discount": 40,               // Rabatt (% oder €)
  "discount_type": "PERCENT"    // "PERCENT" oder "AMOUNT"
}
```

---

## Datenbank-Struktur

### `position_groups` — Produktgruppen

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | BIGINT (PK) | Easybill ID |
| `name` | TEXT | Name |
| `display_name` | TEXT | Anzeigename (z.B. "W10 - Kreissägeblätter") |
| `number` | TEXT | Nummer (z.B. "W10") |
| `description` | TEXT | Beschreibung |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `customer_groups` — Kundengruppen

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | BIGINT (PK) | Easybill ID |
| `name` | TEXT | Name |
| `display_name` | TEXT | Anzeigename |
| `number` | TEXT | Nummer (z.B. "KD0") |
| `created_at` | TIMESTAMPTZ | |

### `products` — Artikelstamm

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | BIGINT (PK) | Easybill Position-ID |
| `number` | TEXT | Artikelnummer (z.B. "101002") |
| `description` | TEXT | Bezeichnung |
| `type` | TEXT | "SERVICE" oder "PRODUCT" |
| `group_id` | BIGINT (FK) | → position_groups.id |
| `cost_price` | NUMERIC | Einkaufspreis (Cent) |
| `sale_price` | NUMERIC | Verkaufspreis (Cent) |
| `vat_percent` | NUMERIC | MwSt.-Satz |
| `unit` | TEXT | Einheit |
| `archived` | BOOLEAN | Archiviert? |
| `note` | TEXT | Notiz |
| `manufacturer` | TEXT | **Manuell ergänzbar** |
| `category` | TEXT | **Manuell: "service" oder "trade"** |
| `raw_easybill_payload` | JSONB | Original-Daten |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `partner_discounts` — Kunden-Rabatte

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | UUID (PK) | |
| `partner_id` | UUID (FK) | → partners.id |
| `easybill_discount_id` | BIGINT | Easybill Rabatt-ID |
| `position_group_id` | BIGINT (FK) | → position_groups.id |
| `discount_percent` | NUMERIC | Rabatt-Prozentsatz |
| `discount_type` | TEXT | "PERCENT" oder "AMOUNT" |
| `raw_easybill_payload` | JSONB | Original-Daten |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**UNIQUE:** (partner_id, position_group_id) — pro Kunde+Gruppe nur ein Rabatt

---

## Ablauf

### Initial-Import (einmalig)
1. **Produktgruppen** laden (`GET /position-groups`)
2. **Kundengruppen** laden (`GET /customer-groups`)
3. **Artikel** laden (`GET /positions` — ~7.315 Stück, paginiert)
4. **Rabatte** laden (`GET /discounts/position-group` — ~886 Stück)
5. Alles in DB speichern

### Update-Strategie (bei Änderung)
- **Produktgruppen + Kundengruppen:** Voll-Replace (wenige Daten)
- **Artikel:** Upsert (neue hinzufügen, bestehende aktualisieren)
- **Rabatte:** Voll-Replace pro Kunde (alte löschen, neue importieren)

### Anzeige im TMS
- **Kundendetail:** Tab "Rabatte" — Tabelle mit Produktgruppe + Rabatt%
- **Artikel-Übersicht:** Separate Seite/Tab (später)
- **Artikel-Detail:** Hersteller + Kategorie manuell bearbeitbar

---

## Akzeptanzkriterien

- [ ] Alle ~40 Produktgruppen importiert
- [ ] Alle ~8 Kundengruppen importiert
- [ ] Alle ~7.315 Artikel importiert (mit Preisen)
- [ ] Alle ~886 Rabatte importiert
- [ ] Rabatte im Kundendetail sichtbar (neuer Tab)
- [ ] Artikel können nach Hersteller gefiltert werden (manuell ergänzt)
- [ ] Artikel können als "service" oder "trade" klassifiziert werden
- [ ] Keine Duplikate bei Rabatten (Partner + Gruppe = UNIQUE)
- [ ] Update bei Änderung in Easybill funktioniert

---

## Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| 7.315 Artikel = langsam | Mittel | Batch-Import, 100/Stück |
| API-Rate-Limit (60/min) | Hoch | Requests drosseln, 1/sec |
| Artikel ohne Gruppe | Niedrig | Gruppe "Unbekannt" anlegen |
| `type: SERVICE` ist nicht korrekt | Mittel | Manuell nachkorrigierbar |

---

## Nächste Schritte ✅ ALLES ERLEDIGT

1. ✅ Spec review + "approved" (Jan Bernd)
2. ✅ Architektur-Dokument erstellt
3. ✅ Datenbank-Tabellen angelegt
4. ✅ Initial-Import (Gruppen → Artikel → Rabatte)
5. ✅ Rabatte-Tab im Kundendetail gebaut
6. ⏳ Artikel-Übersicht (optional, später — nicht Teil dieses Projekts)
7. ✅ Test mit echten Daten (erfolgreich: 7.315 Artikel + 886 Rabatte)

---

*Erstellt: 2026-07-10 10:43 UTC*  
*Aktualisiert: 2026-07-10 11:21 UTC (Deployed)*
