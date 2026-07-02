# PROJ-14: Kundendetailseite — Umsätze anzeigen + Service-Icon fix

## Status: Deployed ✅ (2026-07-02)
## Author: Klausi
## Date: 2026-07-02

---

## Zusammenfassung (1 Satz)

Behebt zwei Bugs auf der Kundendetailseite: Umsätze werden nicht geladen (RLS-Blockierung) und das Service-Icon zeigt einen Dollar statt Schraubenschlüssel.

---

## Motivation

Jan Bernd hat zwei Probleme gemeldet:
1. Auf der Umsatz-Tab bei Tünnissen steht „Keine Umsatzdaten", obwohl in der Datenbank Daten vorhanden sind.
2. Die Service-Karte zeigt das falsche Icon (Receipt/Dollarzeichen) — es soll ein Schraubenschlüssel sein.

---

## Was wird geändert

### Bug 1: Umsätze bleiben leer
- **Ursache:** Die `revenue.ts` nutzt `createClient()` (Anon-Key), der von RLS an der Materialized View `mv_partner_monthly_revenue` blockiert wird.
- **Fix:** Auf `createAdminClient()` (Service-Role-Key) umstellen. Kein Sicherheitsrisiko, da reine aggregierte Lese-Daten ohne personenbezogene Daten.
- **Dateien:** `src/lib/actions/revenue.ts`

### Bug 2: Falsches Icon für Service
- **Ursache:** Im `RevenueSummary`-Komponenten wird `Receipt` aus `lucide-react` für Service verwendet.
- **Fix:** Auf `Wrench` wechseln.
- **Dateien:** `src/app/kunden/[id]/components/revenue-summary.tsx`

---

## Abgrenzung: Was machen wir NICHT

- Keine neue UI-Elemente
- Keine neuen Datenbank-Spalten
- Keine Änderung der Materialized View oder Datenstruktur
- Keine Änderung der API-Signatur

---

## Akzeptanzkriterien

- [x] Umsatz-Tab zeigt bei Tünnissen Umsatzdaten für 2026 (z.B. Mai: €1.491,91)
- [x] Die Service-Karte zeigt ein Schraubenschlüssel-Icon (Wrench)
- [x] Alle anderen Umsatz-Karten und das Chart funktionieren weiterhin
- [x] Kein Regressionsrisiko bei anderen Partnern

---

## Testplan (kurz)

1. Umsatz-Tab für Partner „Tünnissen GmbH" aufrufen
2. Erwartet: Balkendiagramm mit Daten, keine „Keine Umsatzdaten"-Meldung
3. Service-Karte zeigt Schraubenschlüssel-Icon
4. Andere Partner ohne Umsätze zeigen korrekt „Keine Umsatzdaten"

---

## Abhängigkeiten

- Keine. Reiner Bugfix in bestehendem PROJ-11 Code.

## Risiken

- **Risiko:** Service-Role-Key missbrauchen. **Eindämmung:** Nur bei aggregierten Read-Only-Views, keine personenbezogenen Daten.
