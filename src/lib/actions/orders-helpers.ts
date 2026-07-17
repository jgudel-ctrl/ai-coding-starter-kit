/**
 * Escaped einen Suchbegriff für die Einbettung in einen PostgREST
 * `.or()`-Filter-String. Ohne Escaping könnten Zeichen wie `,` oder `)`
 * die Filter-Syntax verändern und zusätzliche Bedingungen einschleusen
 * (gefunden bei QA, siehe BUG-2 in features/PROJ-11-kundendetailseite.md).
 * PostgREST erlaubt doppelt gequotete Filterwerte, um Sonderzeichen wörtlich
 * zu behandeln — darin müssen nur Backslash und Anführungszeichen escaped werden.
 */
export function escapeOrFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export interface OrderGroupStat {
  group_id: number;
  group_name: string;
  count: number;
}

export type ProductGroupInfo = { group_id: number | null; group_name: string | null };

/**
 * Zählt Bestellpositionen je Artikelgruppe (Anzahl Rechnungszeilen, nicht
 * Mengen-Summe). Positionen ohne Gruppe fließen bewusst nicht ein — sie
 * sollen im Donut-Chart/Dropdown nicht auftauchen (siehe Decision Log in
 * features/PROJ-11-kundendetailseite.md).
 * Ergebnis absteigend nach Häufigkeit sortiert.
 */
export function buildGroupStats(
  articleNumbers: (string | null)[],
  numberToGroup: Map<string, ProductGroupInfo>
): OrderGroupStat[] {
  const counts = new Map<number, { group_name: string; count: number }>();
  for (const articleNumber of articleNumbers) {
    const group = numberToGroup.get(articleNumber || "");
    if (!group?.group_id || !group.group_name) continue;
    const existing = counts.get(group.group_id);
    counts.set(group.group_id, {
      group_name: group.group_name,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...counts.entries()]
    .map(([group_id, v]) => ({ group_id, group_name: v.group_name, count: v.count }))
    .sort((a, b) => b.count - a.count);
}
