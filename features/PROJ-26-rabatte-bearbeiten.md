# PROJ-26: Rabatte bearbeiten (Admin-only + Easybill-Sync)

> Status: ✅ Deployed | 2026-07-10 14:30 UTC
> Typ: Erweiterung von PROJ-25
> Verantwortlich: Jan Bernd Gudel / Klausi
> Priorität: Mittel

---

## Ergebnis

✅ **Deployed am 2026-07-10 um 14:30 UTC**

| Feature | Status |
|---------|--------|
| Inline-Edit für Rabatte (Admin) | ✅ |
| TMS DB Update | ✅ |
| Easybill-Sync (PUT /discounts/position-group/{id}) | ✅ |
| Rollback bei Easybill-Fehler | ✅ |
| Admin-Check (Server-seitig) | ✅ |
| Nicht-Admin: keine Edit-Funktion | ✅ |

**Dateien:**
- `src/lib/easybill/discounts.ts` — Easybill API Client (PUT/DELETE)
- `src/lib/actions/discounts.ts` — `updatePartnerDiscount()` Server Action
- `src/app/(app)/kunden/[id]/components/discounts-card.tsx` — Inline-Edit UI
- `src/app/(app)/kunden/[id]/page.tsx` — `isAdmin` an DiscountsTab übergeben

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Admin kann auf der Kundendetailseite (Tab "Rabatte") direkt den Rabatt-Prozentsatz pro Produktgruppe ändern. Die Änderung wird gespeichert in unserer Datenbank **und** zurück zu Easybill synchronisiert.

**Was Jan Bernd dadurch erreicht:**
- Rabatte direkt im TMS anpassen — kein Wechsel zu Easybill nötig
- Änderung ist sofort in Easybill aktiv (für Rechnungen)
- Nicht-Admin sieht nur die Anzeige, kann aber nichts ändern

---

## IST-Analyse: Easybill API für Rabatte

Easybill hat Rabatte über `/discounts/position-group`:
- **GET** `/discounts/position-group` — Liste aller Rabatte
- **GET** `/discounts/position-group/{id}` — Einzelner Rabatt
- **PUT** `/discounts/position-group/{id}` — Rabatt ändern
- **POST** `/discounts/position-group` — Neuen Rabatt erstellen
- **DELETE** `/discounts/position-group/{id}` — Rabatt löschen

### PUT-Payload (Rabatt ändern):
```json
{
  "customer_id": 688115002,
  "position_group_id": 92522,
  "discount": 30,
  "discount_type": "PERCENT"
}
```

---

## Akzeptanzkriterien

- [ ] Admin sieht Stift-Icon (✏️) oder "Bearbeiten"-Button neben jedem Rabatt
- [ ] Nicht-Admin sieht keinen Edit-Button
- [ ] Klick auf Rabatt-Row öffnet Edit-Modal (oder Inline-Edit)
- [ ] Input: Prozentsatz (0-100, ganze Zahlen)
- [ ] Validierung: Min 0, Max 100, nur Zahlen
- [ ] "Speichern" schreibt Änderung in `partner_discounts` (TMS DB)
- [ ] **Easybill-Sync:** Nach lokalem Speichern → PUT an Easybill API
- [ ] Fehler-Handling: Wenn Easybill-Sync fehlschlägt → User informieren, DB-Änderung rückgängig
- [ ] Erfolgs-Toast: "Rabatt gespeichert und in Easybill aktualisiert"
- [ ] Neue Rabatte erstellen: Admin kann auch neue Gruppe+Rabatt hinzufügen (falls Kunde in Easybill noch keine Rabatt für die Gruppe hat)

---

## UI/UX

### Option A: Inline-Edit (bevorzugt — schneller)
1. Admin klickt auf Prozentsatz-Badge
2. Badge wird zu Input-Feld (automatisch fokussiert)
3. Admin tippt neuen Wert
4. Enter oder Klick außerhalb = Speichern
5. Escape = Abbrechen
6. Lade-Spinner während Sync

### Option B: Modal
1. Admin klickt Stift-Icon neben der Row
2. Modal öffnet sich mit Gruppenname + Input-Feld
3. "Speichern" oder "Abbrechen"

### Admin-Check
```
const isAdmin = currentProfile?.roles?.includes("admin") ?? false;
```

---

## Datenfluss

```
Admin ändert Rabatt (z.B. 35% → 30%)
    ↓
1. TMS DB: UPDATE partner_discounts SET discount_percent = 30
    ↓
2. Easybill API: PUT /discounts/position-group/{easybill_discount_id}
   Payload: { customer_id, position_group_id, discount: 30, discount_type: "PERCENT" }
    ↓
3a. Erfolg: Toast "Gespeichert in TMS + Easybill"
3b. Fehler: Rollback TMS DB → Toast "Fehler: Änderung nicht gespeichert"
```

---

## Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|-------------|
| Easybill API schlägt fehl | Mittel | Rollback in TMS DB, User informieren |
| Rate-Limit (60/min) | Niedrig | Einzel-Request, kein Batch |
| Admin ändert versehentlich | Niedrig | Kein "Sind Sie sicher?" — einfach speichern |
| Easybill-ID fehlt in TMS | Niedrig | Nur Rabatte mit `easybill_discount_id` sind editierbar |

---

## Dateien (voraussichtlich)

- `src/lib/actions/discounts.ts` — Erweitern um `updatePartnerDiscount()`
- `src/lib/easybill/api.ts` — Neue Funktion `updatePositionGroupDiscount()`
- `src/app/(app)/kunden/[id]/components/discounts-card.tsx` — Edit-UI hinzufügen
- `src/app/(app)/kunden/[id]/page.tsx` — `isAdmin` an `DiscountsTab` übergeben

---

*Erstellt: 2026-07-10 14:06 UTC*
*Wartet auf: approved*
