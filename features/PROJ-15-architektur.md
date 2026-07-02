# PROJ-15: Architektur — Vorjahresvergleich + Jahres-/Monats-Ansicht

## Status: Draft
## Author: Klausi
## Date: 2026-07-02

---

## Übersicht der Änderungen

### Datenfluss

```
┌─────────────────┐     ┌─────────────────────────────┐
│  User wählt     │     │  revenue-chart.tsx          │
│  Jahr + Modus   │────▶│  - State: selectedYear      │
│                 │     │  - State: viewMode          │
└─────────────────┘     │    (month | year)           │
                        │  - Toggle-Button            │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │  revenue-summary.tsx        │
                        │  - Props: year, currentData │
                        │  - Props: prevYearData      │
                        │  - Berechnet %-Vergleich    │
                        └─────────────────────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │  revenue.ts (Actions)       │
                        │  - getPartnerRevenueWithComp  │
                        │  - getPartnerYearlyRevenue    │
                        └─────────────┬───────────────┘
                                      │
                        ┌─────────────▼───────────────┐
                        │  Supabase (tms Schema)        │
                        │  - mv_partner_monthly_revenue│
                        └─────────────────────────────┘
```

---

## Backend (Actions)

### 1. `getPartnerRevenueWithComparison(partnerId, year)`

LÄDT BEIDE JAHRE PARALLEL — Spart einen Request.

```typescript
export async function getPartnerRevenueWithComparison(
  partnerId: string,
  year: number
) {
  const supabase = createAdminClient({ schema: "tms" });

  // Parallel: aktuelles Jahr + Vorjahr
  const [currentResult, previousResult] = await Promise.all([
    supabase.from("mv_partner_monthly_revenue")
      .select("month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count")
      .eq("partner_id", partnerId)
      .eq("year", year)
      .order("month"),
    supabase.from("mv_partner_monthly_revenue")
      .select("month, revenue_service, revenue_retail, revenue_custom, revenue_total, gross_profit, invoice_count")
      .eq("partner_id", partnerId)
      .eq("year", year - 1)
      .order("month")
  ]);

  // Map + Normalize (0-Default für fehlende Monate)
  const currentData = normalizeMonthlyData(currentResult.data);
  const previousData = normalizeMonthlyData(previousResult.data);

  // Vorjahres-Summen für KPI-Vergleich
  const previousTotals = calculateTotals(previousData);

  return {
    ok: true,
    currentData,
    previousData,
    previousTotals,
    hasPreviousYear: previousResult.data?.length > 0
  };
}
```

### 2. `getPartnerYearlyRevenue(partnerId)`

LÄDT ALLE JAHRE und aggregiert pro Jahr.

```typescript
export async function getPartnerYearlyRevenue(partnerId: string) {
  const supabase = createAdminClient({ schema: "tms" });

  const { data, error } = await supabase
    .from("mv_partner_monthly_revenue")
    .select("year, revenue_total")
    .eq("partner_id", partnerId)
    .order("year");

  // Gruppiere nach Jahr und summiere
  const yearlyMap = new Map();
  for (const row of data || []) {
    const existing = yearlyMap.get(row.year) || 0;
    yearlyMap.set(row.year, existing + Number(row.revenue_total));
  }

  const years = Array.from(yearlyMap.entries())
    .map(([year, total]) => ({ year, total }))
    .sort((a, b) => a.year - b.year);

  return { ok: true, years };
}
```

---

## Frontend

### RevenueSummary — Vorjahresvergleich

```typescript
interface RevenueSummaryProps {
  data: MonthlyRevenue[];          // Aktuelles Jahr
  previousYearData: MonthlyRevenue[]; // Vorjahr (optional)
  selectedYear: number;
}

// Berechnung der %-Änderung
function calculateChange(current: number, previous: number): string | null {
  if (!previous || previous === 0) return null;
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(0)}%`;
}

// Farbe basierend auf Änderung
function getChangeColor(change: number): string {
  if (change > 0) return "text-green-600";
  if (change < 0) return "text-red-600";
  return "text-gray-400";
}

// In der Karte:
// Betrag: €12.340
// Vergleich: <span className="text-xs text-green-600">+15% vs. 2025</span>
```

### RevenueChart — Toggle + AreaChart

```typescript
type ViewMode = "month" | "year";

// State
const [viewMode, setViewMode] = useState<ViewMode>("month");

// Toggle-Button (oben rechts neben Jahr-Dropdown)
// [Monatsansicht] [Jahresansicht]
// Aktiver Modus: filled, inaktiv: outline

// Daten für AreaChart vorbereiten
const chartData = useMemo(() => {
  if (viewMode === "month") {
    // 12 Monate + Vorjahres-Linie
    return currentData.map((item) => ({
      name: MONTHS[item.month - 1],
      Handelsware: item.revenue_retail,
      Service: item.revenue_service,
      Sonderwerkzeug: item.revenue_custom,
      "Vorjahr Gesamt": previousYearData.find(p => p.month === item.month)?.revenue_total || 0,
    }));
  } else {
    // Alle Jahre
    return yearlyData.map((item) => ({
      name: item.year.toString(),
      Gesamtumsatz: item.total,
    }));
  }
}, [viewMode, currentData, previousYearData, yearlyData]);
```

### Recharts AreaChart Konfiguration

```tsx
<AreaChart data={chartData}>
  <defs>
    <linearGradient id="colorHandel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
    </linearGradient>
    {/* ... weitere Gradients ... */}
  </defs>
  
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="name" />
  <YAxis tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
  <Tooltip />
  <Legend />
  
  {/* Aktuelles Jahr */}
  <Area type="monotone" dataKey="Handelsware" stroke="#3b82f6" fill="url(#colorHandel)" />
  <Area type="monotone" dataKey="Service" stroke="#10b981" fill="url(#colorService)" />
  <Area type="monotone" dataKey="Sonderwerkzeug" stroke="#f59e0b" fill="url(#colorCustom)" />
  
  {/* Vorjahres-Linie (nur Stroke, kein Fill) */}
  <Area type="monotone" dataKey="Vorjahr Gesamt" stroke="#9ca3af" strokeDasharray="5 5" fill="transparent" />
</AreaChart>
```

---

## State-Management

Die State-Verwaltung bleibt lokal im `RevenueChart`-Client-Komponenten:

```
RevenueChart (Client Component)
├── selectedYear: number        ← Jahr-Dropdown
├── viewMode: "month" | "year"  ← Toggle
├── currentData: MonthlyRevenue[]
├── previousData: MonthlyRevenue[]
├── yearlyData: YearlyRevenue[]
└── isLoading: boolean
```

**Wichtig:** Die `RevenueSummary`-Karten bekommen ihre Daten als Props von `RevenueChart`, NICHT von der Server-Action direkt. Dadurch aktualisieren sich die Karten sofort, wenn das Jahr wechselt.

---

## Daten-Transformierung

### Monatsdaten normalisieren (12 Monate, 0 als Default)

```typescript
function normalizeMonthlyData(data: any[] | null): MonthlyRevenue[] {
  const result = new Map();
  for (let i = 1; i <= 12; i++) {
    result.set(i, {
      month: i,
      revenue_service: 0,
      revenue_retail: 0,
      revenue_custom: 0,
      revenue_total: 0,
      gross_profit: 0,
      invoice_count: 0,
    });
  }
  for (const row of data || []) {
    result.set(row.month, {
      month: row.month,
      revenue_service: Number(row.revenue_service) || 0,
      revenue_retail: Number(row.revenue_retail) || 0,
      revenue_custom: Number(row.revenue_custom) || 0,
      revenue_total: Number(row.revenue_total) || 0,
      gross_profit: Number(row.gross_profit) || 0,
      invoice_count: Number(row.invoice_count) || 0,
    });
  }
  return Array.from(result.values());
}
```

---

## Fehlerbehandlung

| Szenario | Verhalten |
|----------|-----------|
| Keine Daten für ausgewähltes Jahr | "Keine Umsatzdaten für {year} verfügbar" |
| Kein Vorjahr vorhanden | Kein Vergleichs-Text in KPIs, keine Vorjahres-Linie |
| Nur 1 Jahr Daten insgesamt | Jahresansicht zeigt 1 Punkt, Monatsansicht normal |
| API-Fehler | Toast/Error-Message, leerer Chart |

---

## Keine neuen Abhängigkeiten

- Recharts hat `AreaChart`, `Area`, `defs`, `linearGradient` bereits integriert
- Keine neuen npm-Packages
- Keine Datenbank-Migration

---

## Performance

- Beide Jahre parallel laden → ~2x schneller als sequentiell
- `useMemo` für Chart-Daten → keine unnötigen Re-Rechnungen
- Lazy loading der Jahresdaten erst bei Toggle auf "Jahresansicht"

---

## Mobile-Optimierung

- Toggle als kleine Segmented-Control (2 Buttons nebeneinander)
- Karten bleiben 2-spaltig auf Mobile
- Chart scrollbar via `ResponsiveContainer`
- Tooltip angepasst für Touch-Interaktion
