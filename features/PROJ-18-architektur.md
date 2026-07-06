# PROJ-18 — Architektur: Globaler Header mit Navigation

**Status:** Deployed ✅  
**Erstellt:** 2026-07-03

---

## Übersicht

Erweiterung des bestehenden `AppHeader` um ein Burger-Menü mit Navigation zu Werkstatt-Bereichen.

---

## Bestehende Struktur

```
src/
├── app/(app)/
│   └── layout.tsx          # Nutzt AppHeader
├── components/
│   ├── app-header.tsx      # ← ZIEL: Hier erweitern
│   └── ui/
│       ├── dropdown-menu.tsx   # Bereits vorhanden
│       ├── sheet.tsx           # shadcn Sheet für Drawer
│       └── button.tsx          # Bereits vorhanden
├── lib/
│   └── actions/
│       └── auth.ts           # signOutAction
```

---

## Geplante Änderungen

### 1. `src/components/app-header.tsx` (Erweiterung)

**Was bleibt:**
- Logo + "TMS 2.0" Text (wird jetzt klickbar)
- User-Dropdown rechts (Logout, Passwort ändern)
- Sticky Header, border-b, bg-card

**Was kommt neu:**
- Burger-Button (Menu Icon) links vom Logo
- Sheet/Drawer öffnet sich von links
- Navigation-Liste mit 7 Punkten

**Layout nach Änderung:**
```
┌─────────────────────────────────────────────────────────────────┐
│ [☰] [Logo] TMS 2.0                              [Avatar ▼]    │
└─────────────────────────────────────────────────────────────────┘
  │
  └── öffnet Sheet von links:
      ┌───────────────────────────┐
      │ 🏠 Home                   │ ← visuell abgesetzt
      ├───────────────────────────┤ ← Separator
      │ 🚚 Fahrer                 │
      │ 📦 Wareneingang           │
      │ 🔧 Arbeitsvorbereitung    │
      │ ⚙️  Maschine              │
      │ ✅ Qualitätssicherung     │
      │ 📤 Warenausgang           │
      └───────────────────────────┘
```

### 2. Neue Komponente: `NavigationMenu` (optional inline)

Entscheidung: **Inline in app-header.tsx** behalten (keine separate Datei), da:
- Nur an einer Stelle verwendet
- Wenig Code (~40 Zeilen)
- Keine Wiederverwendung geplant

---

## Icons (lucide-react)

| Bereich | Icon-Name |
|---------|-----------|
| Home | `Home` |
| Fahrer | `Truck` |
| Wareneingang | `Package` |
| Arbeitsvorbereitung | `Wrench` |
| Maschine | `Cog` |
| Qualitätssicherung | `ShieldCheck` oder `CheckCircle` |
| Warenausgang | `PackageOpen` oder `Send` |
| Burger-Menü | `Menu` |

**Für Qualitätssicherung:** `ShieldCheck` (passender als CheckCircle — zeigt "Schutz/Prüfung")

**Für Warenausgang:** `Send` oder `ArrowUpFromLine` (Ware geht raus)

---

## Routing

Alle Menüpunkte verlinken auf (noch nicht existierende) Routen:

| Label | Route | Bemerkung |
|-------|-------|-----------|
| Home | `/home` | existiert als `/dashboard` → redirect oder umbenennen |
| Fahrer | `/fahrer` | neu |
| Wareneingang | `/wareneingang` | neu |
| Arbeitsvorbereitung | `/arbeitsvorbereitung` | neu |
| Maschine | `/maschine` | neu |
| Qualitätssicherung | `/qualitaetssicherung` | neu |
| Warenausgang | `/warenausgang` | neu |

**Entscheidung:** Links setzen auf die neuen Routen. Die Seiten werden später gebaut — bis dahin zeigt Next.js 404.

---

## UI-Details

### Sheet-Konfiguration
- **Seite:** `side="left"`
- **Breite:** `w-72` (18rem = 288px)
- **Header:** "Navigation" + X-Button zum Schließen
- **Close:** Klick außerhalb, Swipe, X-Button, Escape

### Home-Item Absetzung
```
<div className="pb-4 mb-4 border-b border-border">
  {/* Home Item */}
</div>
{/* Restliche Items */}
```

### Aktiver Zustand (Zukunft)
- Wenn Route == Menüpunkt: `bg-muted` oder `text-primary` highlight
- Für MVP: Optional, kann später kommen

---

## Tech Stack

| Komponente | Quelle |
|------------|--------|
| Sheet (Drawer) | `@/components/ui/sheet.tsx` (shadcn) |
| Button | `@/components/ui/button.tsx` |
| Icons | `lucide-react` |
| Navigation | `next/link` |

---

## State Management

**Lokal in Komponente:**
```tsx
const [open, setOpen] = useState(false)
```

Kein globaler State nötig — Menü ist nur lokal für den Header.

---

## Responsive Verhalten

| Breakpoint | Verhalten |
|------------|-----------|
| Mobile | Sheet nimmt ~80% Breite oder `w-72` |
| Desktop | Sheet `w-72` von links |

---

## Accessibility

- `aria-label="Navigation öffnen"` auf Burger-Button
- `SheetTitle` für Screenreader
- Focus-Trap im Sheet (shadcn macht das automatisch)
- Escape zum Schließen

---

## Abhängigkeiten

**Keine neuen Packages** — alles bereits vorhanden:
- lucide-react ✓
- @radix-ui/react-dialog (via Sheet) ✓
- next/link ✓

---

## Test-Plan

### Manuelle Tests

1. **Burger-Icon klicken** → Sheet öffnet sich von links
2. **Menüpunkt klicken** → Navigiert zu Route (404 ok)
3. **X-Button klicken** → Sheet schließt
4. **Außerhalb klicken** → Sheet schließt
5. **Escape drücken** → Sheet schließt
6. **Logo klicken** → Geht zu `/home`
7. **User-Menü klicken** → Dropdown öffnet (bestehende Funktion)
8. **Logout** → Funktioniert weiterhin

### Mobile Tests
- Sheet lässt sich mit Swipe schließen
- Touch-Targets groß genug (min 44px)

---

## Offene Entscheidungen

| Frage | Entscheidung |
|-------|--------------|
| Home = `/dashboard` oder `/home`? | `/home` — Dashboard wird zu Home umbenannt/redirect |
| Separate Navigation-Komponente? | Nein, inline in app-header.tsx |
| Icons für QS/Warenausgang? | `ShieldCheck` und `Send` |
| Rollen-basierte Anzeige? | Nein, erstmal alle sichtbar |

---

## Änderungsverlauf

| Datum | Autor | Änderung |
|-------|-------|----------|
| 2026-07-03 | Klausi | Initiale Architektur |
| 2026-07-03 | Klausi | Deployed ✅ |
