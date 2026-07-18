"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildGroupStats,
  centsToEuro,
  chunk,
  escapeOrFilterValue,
  rowQualifies,
  type OrderGroupStat,
  type ProductGroupInfo,
} from "./orders-helpers";

export interface TradeOrderItem {
  document_date: string;
  document_number: string;
  description: string;
  article_number: string | null;
  quantity: number;
  unit_price_net: number;
  discount_percent: number | null;
  total_net: number;
  purchase_price: number | null;
  group_id: number | null;
  group_name: string | null;
}

// Chunk-Größe für `.in(...)`-Lookups: hält die PostgREST-Query-URL kurz genug,
// damit sie das URI-Längenlimit nicht sprengt (Ursache von BUG-5).
const IN_FILTER_CHUNK = 150;

/**
 * Baut die Map article_number -> { group_id, group_name } — aber NUR für die
 * übergebenen (bereits kunden-bezogenen) Artikelnummern, nicht für den ganzen
 * Katalog. invoice_items.article_number ist nicht per FK mit products.number
 * verknüpft (unterschiedliche Herkunft der Daten), daher zweistufiger Join in
 * der App-Schicht.
 *
 * Die Lookups werden in Blöcke (IN_FILTER_CHUNK) aufgeteilt, damit die
 * `.in("number", …)`-Query-URL kurz bleibt — sonst „URI too long" bei Kunden
 * mit vielen verschiedenen Artikeln (BUG-5). Nur Artikel mit type='PRODUCT'
 * landen in der Map; alles andere (kein Match / SERVICE) fehlt bewusst und
 * wird dadurch später ausgeblendet.
 */
async function buildNumberToGroupMap(
  supabase: ReturnType<typeof createAdminClient>,
  articleNumbers: (string | null)[]
): Promise<Map<string, ProductGroupInfo>> {
  const distinct = [...new Set(articleNumbers.filter((n): n is string => !!n))];
  const numberToGroup = new Map<string, ProductGroupInfo>();
  if (distinct.length === 0) return numberToGroup;

  const products: { number: string; group_id: number | null }[] = [];
  for (const block of chunk(distinct, IN_FILTER_CHUNK)) {
    const { data, error } = await supabase
      .from("products")
      .select("number, group_id")
      .eq("type", "PRODUCT")
      .in("number", block);
    if (error) throw error;
    for (const p of data || []) products.push({ number: p.number, group_id: p.group_id ?? null });
  }

  const groupIds = [...new Set(products.map((p) => p.group_id).filter((id): id is number => !!id))];
  const groupNames = new Map<number, string>();
  for (const block of chunk(groupIds, IN_FILTER_CHUNK)) {
    const { data, error } = await supabase
      .from("position_groups")
      .select("id, name")
      .in("id", block);
    if (error) throw error;
    for (const g of data || []) groupNames.set(g.id, g.name);
  }

  for (const p of products) {
    numberToGroup.set(p.number, {
      group_id: p.group_id,
      group_name: p.group_id ? groupNames.get(p.group_id) ?? null : null,
    });
  }

  return numberToGroup;
}

/**
 * Holt die Rechnungspositionen eines Kunden (begrenzt auf diesen Kunden,
 * daher keine URI-Längen-Probleme). Sortiert nach Rechnungsdatum absteigend.
 * `search` wird — falls gesetzt — direkt in der DB gefiltert.
 *
 * Hinweis (BUG-6): Es wird bewusst NICHT auf `revenue_category='trade_goods'`
 * gefiltert — diese Spalte ist in der Produktions-DB für alle 120k Positionen
 * NULL (keine Klassifizierungs-Pipeline vorhanden). Die Abgrenzung „Handelsware"
 * erfolgt stattdessen über den Join auf `products.type='PRODUCT'` (siehe Spec
 * 2.4.1 / `rowQualifies` / `buildGroupStats`) — Positionen ohne passenden
 * Produkt-Eintrag (z.B. Dienstleistungen, Versand) werden dort ausgeblendet.
 */
async function fetchCustomerTradeRows(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  select: string,
  search?: string
) {
  // PostgREST liefert pro Anfrage maximal ~1000 Zeilen (Server-Default). Damit
  // die „gesamte Historie" (Donut-Chart) und die Pagination bei Kunden mit vielen
  // Positionen vollständig bleiben, wird seitenweise via `.range()` durchgeblättert.
  //
  // Sortiert wird bewusst nach dem eindeutigen `id` (Primärschlüssel), NICHT nach
  // `invoices.document_date`: Ein nicht-eindeutiger Sortierschlüssel würde beim
  // Seitenwechsel (1000er-Grenze) Zeilen doppeln oder verschlucken (Gleichstände
  // sind nicht deterministisch geordnet) — genau das ließ die Tabelle bei großen
  // Kunden ~4 Positionen verlieren. Die Anzeige-Sortierung nach Datum passiert
  // anschließend im Speicher (siehe getPartnerTradeOrders). `id` liegt zudem auf
  // der Basistabelle, wodurch das fragile Embed-Ordering ganz entfällt.
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("invoice_items")
      .select(select)
      .eq("invoices.partner_id", partnerId)
      .not("description", "is", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);

    if (search) {
      const escaped = escapeOrFilterValue(search);
      query = query.or(`description.ilike."%${escaped}%",article_number.ilike."%${escaped}%"`);
    }

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []) as any[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}

export async function getPartnerTradeOrders(
  partnerId: string,
  page: number = 1,
  pageSize: number = 20,
  search?: string,
  groupId?: number
) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    // Kunden-Positionen zuerst (begrenzt) holen, dann gegen den Produktstamm
    // mappen — statt den ganzen Katalog in einen `.in()`-Filter zu packen (BUG-5).
    const rows = await fetchCustomerTradeRows(
      supabase,
      partnerId,
      `
        description,
        article_number,
        quantity,
        single_price_net,
        discount,
        total_price_net,
        cost_price_net,
        invoices!inner(document_date, invoice_number, partner_id)
      `,
      search
    );

    const numberToGroup = await buildNumberToGroupMap(
      supabase,
      rows.map((r) => r.article_number)
    );

    // Nur echte Produkte (type=PRODUCT) und — falls gesetzt — die gewählte Gruppe.
    // Filterung + Pagination in der App, damit totalCount nach dem Typ-Filter stimmt.
    const filtered = rows.filter((r) => rowQualifies(r.article_number, numberToGroup, groupId));
    // Anzeige-Sortierung nach Rechnungsdatum absteigend (im Speicher, da die
    // DB-Abfrage aus Pagination-Stabilität nach `id` sortiert — siehe
    // fetchCustomerTradeRows). Neueste zuerst.
    filtered.sort((a, b) =>
      String(b.invoices?.document_date || "").localeCompare(String(a.invoices?.document_date || ""))
    );
    const totalCount = filtered.length;

    const start = (page - 1) * pageSize;
    const items: TradeOrderItem[] = filtered.slice(start, start + pageSize).map((item: any) => {
      const group = numberToGroup.get(item.article_number || "");
      return {
        document_date: item.invoices?.document_date || "",
        // DB-Spalte heißt `invoice_number` (früher fälschlich `document_number`,
        // existierte nie in der Produktions-DB → 42703, siehe BUG-6). Client-Feld
        // bleibt `document_number`, damit die UI-Komponenten unverändert bleiben.
        document_number: item.invoices?.invoice_number || "",
        description: item.description || "",
        article_number: item.article_number,
        quantity: Number(item.quantity) || 0,
        // Preisspalten liegen in Cent (int) vor → /100 für Euro (BUG-6).
        // Reale DB-Spalten: single_price_net / total_price_net / cost_price_net;
        // `discount` ist ein Prozentwert (numeric), nicht skalieren.
        unit_price_net: centsToEuro(item.single_price_net),
        discount_percent: item.discount != null ? Number(item.discount) : null,
        total_net: centsToEuro(item.total_price_net),
        purchase_price: item.cost_price_net != null ? centsToEuro(item.cost_price_net) : null,
        group_id: group?.group_id ?? null,
        group_name: group?.group_name ?? null,
      };
    });

    return {
      ok: true,
      items,
      totalCount,
    } as const;
  } catch (err) {
    console.error("Unexpected error fetching trade orders:", err);
    return {
      ok: false,
      error: "Unerwarteter Fehler",
      items: [],
      totalCount: 0,
    } as const;
  }
}

/**
 * Aggregiert die Bestellpositionen eines Kunden nach Artikelgruppe —
 * über die gesamte Historie (nicht paginiert), für Donut-Chart + Dropdown.
 * Nur Gruppen mit mindestens einer Position werden zurückgegeben.
 */
export async function getPartnerOrderGroupStats(partnerId: string, search?: string) {
  try {
    const supabase = createAdminClient({ schema: "tms" });

    // Kunden-Positionen zuerst (begrenzt) holen, dann gegen den Produktstamm
    // mappen — statt den ganzen Katalog in einen `.in()`-Filter zu packen (BUG-5).
    const rows = await fetchCustomerTradeRows(
      supabase,
      partnerId,
      `
        article_number,
        invoices!inner(partner_id)
      `,
      search
    );

    const numberToGroup = await buildNumberToGroupMap(
      supabase,
      rows.map((r) => r.article_number)
    );

    const stats = buildGroupStats(
      rows.map((item: any) => item.article_number),
      numberToGroup
    );

    return { ok: true, data: stats } as const;
  } catch (err) {
    console.error("Order group stats fetch error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unerwarteter Fehler",
      data: [] as OrderGroupStat[],
    } as const;
  }
}
