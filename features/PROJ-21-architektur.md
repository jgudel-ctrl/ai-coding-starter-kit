# PROJ-21 — Architektur: Fahrer-Seite

**Status:** 🔵 In Review  
**Erstellt:** 2026-07-06  
**Scope:** Route `/fahrer` + Listenansicht + Kartenansicht + Status-Update

---

## Zusammenfassung

Neue Seite `/fahrer` mit zwei Bereichen:
1. **Listenansicht** — Zeigt alle geplanten Touren des eingeloggten Users für heute
2. **Kartenansicht** — Zeigt Kunden-Adressen als Pins auf einer Karte (OpenStreetMap via Leaflet)

Keine Datenbank-Änderungen nötig (nutzt bestehende `tms.tours` + `tms.partners`).

---

## Bestehende Infrastruktur (Vorhanden)

### Header
`src/components/app-header.tsx` hat bereits den Menüpunkt "Fahrer" → `/fahrer` mit `Truck` Icon. Route muss nur noch erstellt werden.

### Datenbank-Tabellen
- `tms.tours` — Enthält alle Touren (PROJ-19, deployed ✅)
- `tms.partners` — Enthält Kunden mit Adresse (company_name, street, zip, city)

### Neue Felder nötig in `tms.partners`?
- `latitude` / `longitude` — Für Karten-Pins. Prüfen, ob vorhanden. Falls nicht → Migration hinzufügen.

---

## Neue Dateien zu erstellen

### 1. Route (App Router)

```
src/app/(app)/fahrer/
├── page.tsx              # Hauptseite — Fahrer-Seite
├── layout.tsx            # Optional: Wrapper für Fahrer-Seite
```

### 2. Server Actions

```
src/app/api/driver/
├── get-driver-tours.ts   # Lädt Touren für eingeloggten Fahrer + heute
├── update-tour-status.ts # Setzt Status auf 'abgeholt'
```

### 3. UI-Komponenten

```
src/components/driver/
├── driver-tour-list.tsx     # Listenansicht der Touren
├── driver-tour-card.tsx     # Einzelne Tour-Karte (Kunde + Adresse + Button)
├── driver-map.tsx           # Kartenansicht mit Leaflet
└── empty-state.tsx          # "Keine Abholungen heute"
```

### 4. Neue Abhängigkeit

```bash
npm install leaflet react-leaflet
npm install -D @types/leaflet
```

---

## Datenfluss

### Sequenz: Seite laden

```
User klickt auf "Fahrer" im Header
  ↓
page.tsx lädt (Server Component)
  ↓
getDriverTours(userId, today) → Supabase
  ↓
JOIN tours × partners
  ↓
Return: Array<TourWithPartner>
  ↓
Hydration → Client Component
  ↓
Render: Liste oben, Karte unten
```

### Sequenz: "Abgeholt" klicken

```
User klickt "Abgeholt" auf einer Tour-Karte
  ↓
updateTourStatus(tourId, 'abgeholt') → Server Action
  ↓
UPDATE tms.tours SET status = 'abgeholt' WHERE id = tourId
  ↓
Revalidate (Server Action mit revalidatePath)
  ↓
Seite aktualisiert → Tour verschwindet aus Liste
```

---

## API / Server Actions

### `getDriverTours(userId: string, date: string)`

```typescript
interface DriverTour {
  id: string;
  status: 'geplant' | 'abgeholt' | ...;
  geplantes_abholdatum: string;
  partner: {
    id: string;
    company_name: string;
    street: string;
    zip: string;
    city: string;
    latitude?: number;    // Optional, falls vorhanden
    longitude?: number;   // Optional, falls vorhanden
  };
}

// SQL (Server Action via Supabase)
SELECT
  t.id,
  t.status,
  t.geplantes_abholdatum,
  json_build_object(
    'id', p.id,
    'company_name', p.company_name,
    'street', p.street,
    'zip', p.zip,
    'city', p.city,
    'latitude', p.latitude,
    'longitude', p.longitude
  ) as partner
FROM tms.tours t
JOIN tms.partners p ON p.id = t.partner_id
WHERE t.fahrer_id = :userId
  AND t.geplantes_abholdatum = :today
  AND t.status = 'geplant'
ORDER BY t.geplantes_abholdatum ASC;
```

### `updateTourStatus(tourId: string, status: string)`

```typescript
// Server Action
UPDATE tms.tours
SET status = :status,
    tatsaechliches_abholdatum = CURRENT_DATE
WHERE id = :tourId;
```

---

## UI-Komponenten-Design

### `DriverTourList` (Client Component)

```tsx
interface Props {
  tours: DriverTour[];
}

// Rendert:
// - Titel: "Meine Abholungen — [Datum]"
// - Liste von DriverTourCard
// - Falls leer: EmptyState
```

### `DriverTourCard` (Client Component)

```tsx
interface Props {
  tour: DriverTour;
  onMarkCollected: (tourId: string) => void;
}

// Rendert:
// ┌─────────────────────────────┐
// │ 🏢 Firma Müller GmbH         │
// │ 📍 Musterstraße 12           │
// │    12345 Berlin              │
// │ [📍 Navigation] [Abgeholt]   │
// └─────────────────────────────┘
```

### `DriverMap` (Client Component)

```tsx
interface Props {
  tours: DriverTour[];
}

// Verwendet: react-leaflet
// - MapContainer mit OpenStreetMap Tiles
// - Marker für jede Tour mit Popup (Kundenname + Adresse)
// - Auto-fitBounds auf alle Marker
// - Höhe: 400px (mobile) / 500px (desktop)
```

---

## Datenbank-Änderungen

### Prüfung: latitude/longitude in partners

```sql
-- Prüfen, ob Spalten existieren
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'partners'
AND column_name IN ('latitude', 'longitude');
```

**Fall A: Spalten existieren bereits** → Keine Migration nötig.

**Fall B: Spalten fehlen** → Migration:

```sql
ALTER TABLE tms.partners
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Index für Geo-Queries
CREATE INDEX idx_partners_location ON tms.partners(latitude, longitude);
```

> Hinweis: Die Karte zeigt nur Pins für Kunden mit Koordinaten. Fehlende Koordinaten = kein Pin, aber weiterhin in der Liste sichtbar.

---

## RLS & Sicherheit

### Bestehende RLS-Policies
Die `tms.tours`-Tabelle hat bereits RLS-Policies (siehe PROJ-19 Architektur). Keine Änderungen nötig.

### Neue Policy (optional)
Falls ein Fahrer nur seine eigenen Touren sehen soll (zusätzliche Sicherheit):

```sql
CREATE POLICY tours_fahrer_select_own ON tms.tours
FOR SELECT USING (
    auth.uid() = fahrer_id
    OR EXISTS (
        SELECT 1 FROM tms.users WHERE id = auth.uid() AND role = 'admin'
    )
);
```

> Empfehlung: Der Filter `fahrer_id = userId` in der Query ist ausreichend. RLS-Policy optional.

---

## Routing

| Route | Beschreibung |
|-------|-------------|
| `/fahrer` | Fahrer-Seite (Liste + Karte) |

Bereits im Header verknüpft — muss nur noch als Next.js Route erstellt werden.

---

## Responsive Design

| Breakpoint | Layout |
|-----------|--------|
| **Mobile** (< 768px) | Liste oben (scrollbar), Karte darunter (400px hoch). Touch-Targets min. 44x44px. |
| **Desktop** (≥ 768px) | Liste links (50%), Karte rechts (50%), nebeneinander. |

---

## Technische Entscheidungen

| Entscheidung | Option A | Option B | Gewählt |
|-------------|----------|----------|---------|
| Karten-Provider | Leaflet (OpenStreetMap, kostenlos) | Google Maps (API-Key) | **Leaflet** ✅ |
| Karte laden | react-leaflet (React-Wrapper) | Native Leaflet JS | **react-leaflet** ✅ |
| Status-Update | Server Action + revalidatePath | Client-seitiger State | **Server Action** ✅ |
| Koordinaten | In `partners` speichern | Bei Bedarf geocodieren | **In partners speichern** ✅ |

---

## Abhängigkeiten

| Feature | Status | Wird genutzt für |
|---------|--------|----------------|
| PROJ-19 (Tourenverwaltung) | ✅ Deployed | `tms.tours`-Tabelle |
| PROJ-18 (Globaler Header) | ✅ Deployed | Navigation-Link zu `/fahrer` |

---

## Testing (nach Implementierung)

```bash
# Test 1: Seite lädt
curl http://localhost:3000/fahrer

# Test 2: API-Response
# Als eingeloggter User: GET /api/driver/tours

# Test 3: Status-Update
# POST updateTourStatus(tourId, 'abgeholt')

# Test 4: Mobile-Ansicht
# Browser DevTools → Mobile View → iPhone 12 Pro
```

---

## Nächste Schritte (nach diesem PR)

1. **Frontend bauen** — `/frontend`
2. **Backend bauen** — `/backend`
3. **QA** — `/qa`
4. **Deploy** — `/deploy`

---

**Warte auf Approval von Jan Bernd bevor ich mit dem Frontend beginne.**
