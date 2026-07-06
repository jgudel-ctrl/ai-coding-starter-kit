# PROJ-21 — Fahrer-Seite

**Status:** ✅ Deployed  
**Erstellt:** 2026-07-06  
**Zielversion:** MVP  
**Unteraufgaben:** Mehrere (Spec → Architektur → Frontend → Backend → QA → Deploy)

---

## Zusammenfassung

Neue Fahrer-Seite in TMS 2.0. Ein Fahrer sieht seine geplanten Abholungen für heute als Liste und auf einer Karte. Die Seite dient als mobile-first Arbeitsunterlage für den Fahrer unterwegs — ähnlich wie ein Lieferschein (Papier), nur digital.

---

## Nutzer-Stories

**Als** Fahrer  
**möchte ich** eine Übersicht meiner heutigen Abholungen sehen  
**damit ich** weiß, bei welchen Kunden ich heute vorbeikommen muss und in welcher Reihenfolge.

**Als** Fahrer  
**möchte ich** die Kundenadressen auf einer Karte sehen  
**damit ich** die optimale Route planen kann.

---

## Akzeptanzkriterien

### Teil 1: Fahrer-Seite — Übersicht

1. **Neuer Menüpunkt** "Fahrer" im globalen Header (neben Dashboard, Home, Kunden, Werkzeuge, Service, Verwaltung, Einstellungen)
2. **Seite erreichbar** unter `/fahrer`
3. **Sichtbar für alle eingeloggten User** — Keine Rollen-Einschränkung (später ggf. erweitern)

### Teil 2: Listenansicht (oben)

1. **Titel:** "Meine Abholungen — [Heutiges Datum]" (z.B. "Montag, 6. Juli 2026")
2. **Filter automatisch:**
   - `fahrer_id` = ID des eingeloggten Users (User matched)
   - `geplantes_abholdatum` = heute (aktuelles Datum)
   - `status` = `geplant` (nur offene Abholungen — also Status "Offen")
3. **Liste zeigt pro Eintrag:**
   - Kunden-Name (`partners.company_name`)
   - Lieferadresse (Straße, PLZ, Ort aus `partners`)
   - Status-Badge: "Offen" (alle in dieser Liste sind offen)
   - Action-Button: "Abgeholt" (Status auf `abgeholt` setzen)
   - Klick auf Eintrag → Kunden-Detailseite öffnen (oder Expand mit mehr Infos)
4. **Leer-Zustand:** Wenn keine Abholungen heute → "Heute keine Abholungen geplant" + fröhliches Icon

### Teil 3: Kartenansicht (unten)

1. **Karte** zeigt alle heutigen Abhol-Standorte als Pins/Marker
2. **Klick auf Pin** zeigt Popup mit Kunden-Name und Adresse
3. **Karten-Zentrum** automatisch auf den ersten (oder mittleren) Standort
4. **Keine Adresse** → Pin wird nicht angezeigt (nur in Liste)

### Teil 4: Status-Änderung

1. **"Abgeholt"-Button** in der Liste setzt den Status der Tour auf `abgeholt`
2. **Nach Status-Änderung** verschwindet der Eintrag aus der Liste (weil Filter auf `geplant` ist)
3. **Optional:** Bestätigungs-Toast "Abholung bei [Kunde] markiert"

---

## Datenquellen

| Feld | Quelle | Beschreibung |
|------|--------|--------------|
| `tours.id` | `tms.tours` | Tour-ID |
| `tours.partner_id` | `tms.tours` | Verknüpfung zu Kunden |
| `tours.geplantes_abholdatum` | `tms.tours` | Geplantes Abholdatum |
| `tours.status` | `tms.tours` | Aktueller Status (`geplant`, `abgeholt`, etc.) |
| `tours.fahrer_id` | `tms.tours` | Zugewiesener Fahrer |
| `partners.company_name` | `tms.partners` | Kunden-Name |
| `partners.street` | `tms.partners` | Straße |
| `partners.zip` | `tms.partners` | PLZ |
| `partners.city` | `tms.partners` | Ort |
| `partners.latitude` | `tms.partners` | Breitengrad (für Karte) |
| `partners.longitude` | `tms.partners` | Längengrad (für Karte) |

> **Hinweis:** `latitude` und `longitude` müssen ggf. in `partners` ergänzt werden, falls noch nicht vorhanden.

---

## UI/UX

### Layout

```
┌─────────────────────────────────────┐
│  🚚 Meine Abholungen — 6. Juli 2026 │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Firma Müller GmbH          │    │
│  │ Musterstraße 12, 12345 Berlin│    │
│  │ [Abgeholt]                  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Schmidt & Co KG              │    │
│  │ Hauptstraße 45, 54321 Hamburg │    │
│  │ [Abgeholt]                  │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  [🗺️ Karte mit Pins]               │
│                                     │
└─────────────────────────────────────┘
```

### Mobile-Optimierung

- Seite ist primär für mobile Nutzung gedacht (Fahrer hat Handy im Auto)
- Liste scrollbar, Karte darunter
- Große Touch-Targets für Buttons (mindestens 44x44px)
- Adresse ist klickbar → öffnet Google Maps / Apple Maps für Navigation

---

## Technische Hinweise

### Neue Route
- `/fahrer` oder `/driver` (je nach bestehender Konvention)

### API/Actions
- **Neue Action:** `get-driver-tours.ts` — Lädt Touren für eingeloggten Fahrer + heute
- **Neue Action:** `update-tour-status.ts` — Setzt Status auf `abgeholt`

### Abhängigkeiten
- **PROJ-20** (Logistik & Abholung) ist ein anderes Feature — verwandt, aber unabhängig
- **PROJ-19** (Tourenverwaltung) muss deployed sein — ist ✅
- **PROJ-18** (Globaler Header) muss deployed sein — ist ✅

### Karten-Provider
- Vorschlag: **Leaflet** (OpenStreetMap, kostenlos) oder **Google Maps** (API-Key nötig)
- Entscheidung: Technische Entscheidung durch Klausi

---

## Änderungsverlauf

| Datum | Autor | Änderung |
|-------|-------|----------|
| 2026-07-06 | Klausi | Initiale Spec erstellt |
| 2026-07-06 | Klausi | Architektur + Frontend + Backend implementiert |
| 2026-07-06 | Klausi | Docker-Build + Deploy erfolgreich |
| 2026-07-06 | Klausi | Bugfix: Adressen aus partner_addresses laden statt partners |
| 2026-07-06 | Klausi | Feature: Nächste 5 Tage Tab + Kalender-Ansicht hinzugefügt |
| 2026-07-06 | Jan Bernd | Final approved — funktioniert einwandfrei |

---

**Deploy erfolgreich am 2026-07-06. Docker-Container läuft auf Port 3000.**
