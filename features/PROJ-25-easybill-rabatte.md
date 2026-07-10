# PROJ-25: Kunden-Rabatte aus Easybill importieren

> Status: 📝 Draft | 2026-07-10 08:24 UTC  
> Verantwortlich: Jan Bernd Gudel / Klausi  
> Priorität: Mittel (abhängig von PROJ-24)

---

## Zusammenfassung (für Jan Bernd)

**Was wir bauen:**
Jeder Kunde in Easybill hat spezifische Rabatte pro Produktgruppe (z.B. 40% auf Kreissägeblätter, 25% auf Schaftfräser). Diese Rabatte werden automatisch aus Easybill importiert und im TMS angezeigt — initial und bei jeder Änderung.

**Was Jan Bernd dadurch erreicht:**
- **Keine Überraschungen bei Rechnungen:** Rabatte sind direkt sichtbar
- **Verhandlungsbasis:** Wer viel kauft, sieht seinen Rabatt sofort
- **Korrekte Preise:** Rabatte fließen später in die Rechnungserstellung ein
- **Kein manuelles Nachschauen:** Im Easybill → Rabatte werden automatisch synchronisiert

---

## IST-Analyse: Daten in Easybill

### Beispiel-Kunde: Raiffeisen Hohe Mark Hamaland eG

**Kundengruppe:** KD0 - Kunden ohne Zuordnung  
**Easybill ID:** 687795862

### Produktgruppen (Position Groups)

| ID | Nummer | Name | Beschreibung |
|----|--------|------|-------------|
| 92477 | W10 | Kreissägeblätter | HW-Sägeblätter, HSS-Sägeblätter, CV-Sägeblätter |
| 92482 | W11 | Schaftfräser | HW-Schaftfräser, VHW-Schaftfräser, DP-Schaftfräser |
| 92487 | W12 | Bohrungsfräser | HW-Bohrungsfräser, WP-Bohrungsfräser |
| 92492 | W13 | Bohrwerkzeuge | HW-Bohrer, VHW-Bohrer, HSS-Bohrer |
| 92497 | W14 | Wechselschneiden | Wendeschneidplatten, Hobelmesser |

*(... ca. 40 Produktgruppen insgesamt)*

### Kunden-Rabatte (Position-Group Discounts)

| Kunde | Produktgruppe | Rabatt | Typ |
|-------|---------------|--------|-----|
| Kunde A | W10 (Kreissägeblätter) | 40% | PERCENT |
| Kunde A | W11 (Schaftfräser) | 25% | PERCENT |
| Kunde B | W10 (Kreissägeblätter) | 35% | PERCENT |
| Kunde C | W10 (Kreissägeblätter) | 40% | PERCENT |

*(... ca. 880 Rabatte insgesamt, pro Kunde unterschiedlich)*

---

## Datenbank-Struktur

### `partner_discounts` — Kunden-Rabatte

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `id` | UUID | ✅ | PK, auto |
| `partner_id` | UUID | ✅ | Verknüpfung zu partners.id |
| `easybill_discount_id` | BIGINT | — | Easybill Rabatt-ID |
| `position_group_id` | BIGINT | — | Easybill Produktgruppen-ID |
| `position_group_name` | TEXT | — | Name der Produktgruppe |
| `position_group_number` | TEXT | — | Nummer (z.B. "W10") |
| `discount_percent` | NUMERIC | — | Rabatt-Prozentsatz |
| `discount_type` | TEXT | — | 'PERCENT' oder 'AMOUNT' |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-Rabatt als JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert |

### `position_groups` — Produktgruppen (Referenz)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `id` | BIGINT | ✅ | Easybill Produktgruppen-ID (als PK) |
| `name` | TEXT | — | Name (z.B. "Kreissägeblätter") |
| `display_name` | TEXT | — | Anzeigename (z.B. "W10 - Kreissägeblätter") |
| `number` | TEXT | — | Nummer (z.B. "W10") |
| `description` | TEXT | — | Beschreibung |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert |

### `customer_groups` — Kundengruppen (Referenz)

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|-------------|
| `id` | BIGINT | ✅ | Easybill Kundengruppen-ID (als PK) |
| `name` | TEXT | — | Name (z.B. "Kunden ohne Zuordnung") |
| `display_name` | TEXT | — | Anzeigename (z.B. "KD0 - Kunden ohne Zuordnung") |
| `number` | TEXT | — | Nummer (z.B. "KD0") |
| `description` | TEXT | — | Beschreibung |
| `raw_easybill_payload` | JSONB | — | Kompletter Easybill-JSON |
| `created_at` | TIMESTAMPTZ | ✅ | Erstellt bei uns |
| `updated_at` | TIMESTAMPTZ | ✅ | Zuletzt geändert |

---

## Ablauf

### Initial-Import
1. Alle Produktgruppen aus Easybill laden (`GET /position-groups`)
2. Alle Kundengruppen aus Easybill laden (`GET /customer-groups`)
3. Für jeden Kunden:
   - Rabatte laden (`GET /discounts/position-group?customer_id={id}`)
   - In `partner_discounts` speichern
4. Ergebnis loggen

### Update (bei Änderung)
1. Gleiche Logik wie Initial — **Voll-Replace**
2. Alte Rabatte des Partners löschen
3. Neue Rabatte importieren
4. Produktgruppen aktualisieren (falls neue dazugekommen)

---

## Akzeptanzkriterien

- [ ] Alle Produktgruppen sind importiert
- [ ] Alle Kundengruppen sind importiert
- [ ] Alle Kunden-Rabatte sind vorhanden (ca. 880)
- [ ] Bei Änderung in Easybill → Rabatte werden aktualisiert (Voll-Replace)
- [ ] Rabatte sind im Kundendetail sichtbar
- [ ] Keine Duplikate (Partner + Produktgruppe = UNIQUE)

---

## Risiken & Abschwächungen

| Risiko | Wahrscheinlichkeit | Abschwächung |
|--------|-------------------|--------------|
| Easybill API-Limit erreicht | Mittel | Requests limitieren, Paginierung |
| Rabatte ändern sich ständig | Mittel | Voll-Replace bei jedem Sync |
| Produktgruppen nicht gefunden | Niedrig | Fehler loggen, Rabatt überspringen |
| Keine Rabatte für Kunde | Niedrig | Leere Liste anzeigen, kein Fehler |

---

## Nächste Schritte

1. **Jan Bernd:** Spec review + "approved"
2. **Klausi:** Architektur-Dokument erstellen
3. **Klausi:** Datenbank-Tabellen anlegen
4. **Klausi:** Initial-Import der Rabatte
5. **Klausi:** Anzeige im Kundendetail bauen
6. **Gemeinsam:** Test mit echten Daten

---

*Erstellt: 2026-07-10 08:24 UTC*
