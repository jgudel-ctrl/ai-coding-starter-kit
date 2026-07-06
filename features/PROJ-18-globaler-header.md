# PROJ-18 — Globaler Header mit Navigation

**Status:** Deployed ✅  
**Erstellt:** 2026-07-03  
**Zielversion:** MVP

---

## Zusammenfassung

Erweiterung des bestehenden globalen Headers um ein Burger-Menü mit Werkstatt-Navigation. Das Logo wird klickbar und führt zur Startseite.

---

## Nutzer-Stories

**Als** eingeloggter Benutzer  
**möchte ich** über ein Menü schnell zu den verschiedenen Werkstatt-Bereichen navigieren  
**damit ich** effizient zwischen Wareneingang, Maschine, QS usw. wechseln kann.

**Als** Benutzer  
**möchte ich** auf das Logo klicken können  
**damit ich** jederzeit zur Startseite zurückkehren kann.

---

## Akzeptanzkriterien

### Must-Have (MVP)

1. **Burger-Menü links** im Header (links vom Logo)
2. **Menüpunkte** (die Seiten kommen später, jetzt nur Navigation vorbereiten):
   - **Home** (visuell oben/abgesetzt mit Trennlinie)
   - Fahrer
   - Wareneingang
   - Arbeitsvorbereitung
   - Maschine
   - Qualitätssicherung
   - Warenausgang
3. **Menü öffnet/schließt** bei Klick auf Burger-Icon
4. **Logo klickbar** → führt zu `/dashboard`
5. **Login/Logout bleibt rechts** (bestehendes Dropdown-Menü)
6. **Responsive**: Menü funktioniert auf Mobile und Desktop

### Nice-to-Have (nicht Teil dieses Tickets)

- Aktiver Menüpunkt hervorheben (wenn Seiten existieren)
- Unterpunkte/Untermenüs
- Tastatur-Navigation (Escape zum Schließen)

---

## UI/UX Details

### Burger-Menü (links)
```
┌─────────────────────────────────────────────────────────────┐
│ [☰] [Logo] TMS 2.0                    [User ▼]            │
└─────────────────────────────────────────────────────────────┘
```

### Geöffnetes Menü (Sheet/Drawer von links)
```
┌────────────────────────────────────┐
│        Navigation                  │
├────────────────────────────────────┤
│  🏠 Home                           │  ← visuell abgesetzt/oben
├────────────────────────────────────┤  ← Trennlinie
│  🚚 Fahrer                         │
│  📦 Wareneingang                   │
│  🔧 Arbeitsvorbereitung            │
│  ⚙️  Maschine                      │
│  ✅ Qualitätssicherung             │
│  📤 Warenausgang                   │
└────────────────────────────────────┘
```

### Icon-Zuordnung
| Bereich | Icon | Reihenfolge |
|---------|------|-------------|
| Home | Home | 1 (oben, abgesetzt) |
| Fahrer | Truck | 2 |
| Wareneingang | Package | 3 |
| Arbeitsvorbereitung | Wrench | 4 |
| Maschine | Cog | 5 |
| Qualitätssicherung | CheckCircle | 6 |
| Warenausgang | PackageOpen | 7 |

---

## Technische Hinweise

### Bestehende Komponenten
- `src/components/app-header.tsx` — muss erweitert werden
- `src/components/ui/dropdown-menu.tsx` — existiert (für User-Menü)
- `src/components/ui/sheet.tsx` — shadcn Sheet für Drawer

### Neue Abhängigkeiten
- `lucide-react` Icons sind bereits installiert

### Routing (zukünftige Seiten)
Die Menüpunkte sollen vorbereitet sein für:
- `/home` (oder `/dashboard` → umbenennen zu `/home`)
- `/fahrer`
- `/wareneingang`
- `/arbeitsvorbereitung`
- `/maschine`
- `/qualitaetssicherung`
- `/warenausgang`

Für das MVP: Navigation zu diesen Seiten einbauen, auch wenn sie noch 404 geben.

### Auth
- Header ist nur im `(app)` Layout vorhanden (für eingeloggte User)
- Keine extra Auth-Checks nötig

---

## Offene Fragen

1. Sollen die Menüpunkte für alle Rollen sichtbar sein oder rollenspezifisch?
   → **Vorschlag**: Erstmal für alle sichtbar, Rollen-Logik kommt später wenn Seiten existieren.

2. Mobile: Soll das Menü als Sheet von links schieben oder Fullscreen?
   → **Vorschlag**: Sheet von links (wie typische Mobile-Navigation)

---

## Änderungsverlauf

| Datum | Autor | Änderung |
|-------|-------|----------|
| 2026-07-03 | Klausi | Initiale Spec |
| 2026-07-03 | Klausi | Deployed ✅ |
