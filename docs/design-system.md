# Design System — TMS 2.0

> Verbindliche Design-Vorgaben für TMS 2.0 (Gudel Werkzeuge).
> Wird vom `/frontend`-Skill beim Bauen der UI gelesen.
> Quelle: Logo (weiße „TMS"-Marke, SVG) + 3 UI-Referenzen (Dribbble-Bento-Dashboards), vom Kunden vorgegeben.

## 1. Markenfarbe & Palette

**Hauptfarbe (Brand):** `#FF6B6D` — Koralle/Warmrot. `hsl(359, 100%, 71%)`
**Komplementärfarbe (Sekundär):** `#4ECDC4` — Türkis. `hsl(176, 56%, 55%)` (direktes Gegenstück auf dem Farbkreis)

### Primär (Koralle)
| Token | Hex | Verwendung |
|-------|-----|-----------|
| primary-50  | `#FFF0F0` | Tints, Hintergrund von Alert-/Aktiv-Chips |
| primary-400 | `#FF8E90` | Hover-Light, Verläufe |
| primary-500 | `#FF6B6D` | **Hauptfarbe** — Buttons, aktive Nav, Brand |
| primary-600 | `#E85A5C` | Hover/Pressed |
| primary-700 | `#C9484A` | Text auf hellem Grund, Fokus-Ring |

### Sekundär (Türkis, komplementär)
| Token | Hex | Verwendung |
|-------|-----|-----------|
| secondary-50  | `#E8FAF8` | Tints |
| secondary-500 | `#4ECDC4` | Sekundäraktionen, Akzente, QS-Station |
| secondary-600 | `#3DB8AF` | Hover |

### Neutral (kühles Grau — wie in den Referenzen)
| Token | Hex | Verwendung |
|-------|-----|-----------|
| bg-app    | `#F7F8FA` | App-Hintergrund |
| surface   | `#FFFFFF` | Karten / Bento-Tiles |
| border    | `#EAECEF` | Rahmen, Trenner |
| text      | `#1A1D29` | Primärtext, große Kennzahlen |
| text-mut  | `#6B7280` | Sekundärtext, Labels |
| text-dis  | `#9AA1AC` | Deaktiviert, Platzhalter |

## 2. Stationsfarben (semantisch — Kern des Werkzeug-Workflows)

Jede Station hat eine feste Farbe für Badges, Status-Chips und Charts. Der durchgängige Werkzeug-Status wird überall mit derselben Farbe gezeigt (lückenlose visuelle Nachverfolgung).

| Station | Hex | |
|---------|-----|--|
| Wareneingang        | `#4DABF7` | Blau |
| Arbeitsvorbereitung | `#7C6CFF` | Indigo (legt den Pfad fest) |
| Maschine            | `#F59F00` | Amber |
| Qualitätssicherung  | `#4ECDC4` | Türkis (= Sekundärfarbe) |
| Warenausgang        | `#2FB344` | Grün (= „fertig/ok") |
| Extern              | `#868E96` | Slate (Fremdbearbeitung) |
| **Rückläufer / Achtung** | `#FF6B6D` | **Koralle (= Brand)** — dient zugleich als Alert-/Fehlerfarbe |

> Bewusste Entscheidung: Die Brand-Koralle ist semantisch ein Rot und wird als **Achtung/Rückläufer**-Akzent doppelt genutzt (QS → zurück zur Maschine). So braucht es kein zweites, konkurrierendes Rot.

### Chart-Reihen (mehrfarbige Diagramme)
Reihenfolge: `#FF6B6D` · `#4ECDC4` · `#7C6CFF` · `#F59F00` · `#4DABF7` · `#2FB344`

## 3. Layout & Komponenten

**Designsprache:** Bento-/Karten-Layout (wie in allen drei Referenzen), weiche Rundungen, dezente Schatten, viel Weißraum.

- **Radien:** Karten `rounded-2xl` (16px) · Buttons `rounded-xl` (12px) · Chips/Badges `rounded-full`
- **Schatten:** dezent, weich (`shadow-sm`/`shadow-md`), kein harter Rand
- **KPI-Karten:** große, fette Zahl + kleines Label + Trend-Indikator (↑/↓ in Grün/Koralle)
- **Charts:** Donut (Status-Verteilung über Stationen), Linie (Durchlaufzeit/Trend), Balken (Auslastung je Station)
- **Statusanzeige:** farbige Chips/Badges in Stationsfarbe + Text (nicht nur Farbe → barrierearm)

## 4. Mobile-First & Tablet (Pflicht)

Die Referenzen sind mobil — Mobile ist Leitmedium, Tablet gleichwertig wichtig (Stations-Terminals).

- **Mobile:** Single-Column, **Bottom-Tab-Navigation** (Home / Übersicht / Aktion / Profil), Karten gestapelt.
- **Tablet:** 2–3-spaltiges Bento-Grid; Navigation kann zur Seitenleiste werden.
- **Touch-Targets:** min. 44px, **Ziel 48px** (Bedienung an der Maschine, ggf. mit Handschuhen).
- **Kontrast & Lesbarkeit:** große Schrift, hoher Kontrast — auch in heller Werkstatt-Umgebung lesbar.
- Umsetzung über Tailwind-Breakpoints (`sm`/`md`/`lg`), responsives Grid statt fixer Pixel.

## 5. Typografie

- **Schrift:** Inter (passt zu shadcn/ui-Defaults; Referenzen nutzen eine vergleichbare neutrale Sans).
- **Kennzahlen:** groß & fett (`text-3xl`/`text-4xl`, `font-bold`), tabular-nums für Zahlen.
- **Labels:** `text-sm`, `text-mut`, ggf. Uppercase-Tracking für Sektionsüberschriften.

## 6. Logo

- Datei: `public/logo.svg` — **weiße** „TMS"-Wortmarke/Icon (512×512, transparent).
- Einsatz: auf **Primärfarbe (#FF6B6D)** oder dunklen Flächen. Für helle Flächen eine dunkle/korallene Variante ableiten.
- Verwendung in Login-Screen, App-Header und als App-Icon.

## 7. shadcn/ui-Tokens (Referenz für `globals.css`)

```css
:root {
  --primary: 359 100% 71%;        /* #FF6B6D */
  --primary-foreground: 0 0% 100%;
  --secondary: 176 56% 55%;       /* #4ECDC4 */
  --background: 220 22% 97%;       /* #F7F8FA */
  --card: 0 0% 100%;
  --border: 220 13% 92%;           /* #EAECEF */
  --foreground: 230 20% 13%;       /* #1A1D29 */
  --muted-foreground: 220 9% 46%;  /* #6B7280 */
  --radius: 1rem;                  /* rounded-2xl Basis */
}
```

> Dunkelmodus: bewusst als spätere Erweiterung (P2) eingeplant, nicht im MVP.
