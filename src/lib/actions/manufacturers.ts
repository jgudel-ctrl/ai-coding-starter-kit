"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

export type Manufacturer = {
  id: string;
  name: string;
  notes: string | null;
  product_count: number;
  created_at: string;
  updated_at: string;
};

export type ProductWithManufacturer = {
  id: string;
  number: string;
  description: string;
  manufacturer_id: string | null;
  manufacturer_name: string | null;
  type: string;
};

export type ImportResult = {
  manufacturers_created: number;
  manufacturers_skipped: number;
  products_linked: number;
  products_without_manufacturer: number;
};

/* ═══════════════════════════════════════════
   Admin-Check
   ═══════════════════════════════════════════ */

async function requireAdmin(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return !!profile && isAdmin(profile.roles) && profile.status === "aktiv";
}

/* ═══════════════════════════════════════════
   1) Hersteller importieren (einmalig)
   ═══════════════════════════════════════════ */

export async function importManufacturers(): Promise<
  { ok: true; data: ImportResult } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  try {
    const admin = createAdminClient();

    // 1a) Alle distinct Hersteller-Namen aus Easybill-JSON extrahieren
    const { data: distinctNotes, error: notesError } = await admin
      .from("products")
      .select("raw_easybill_payload->>note" as any)
      .eq("type", "PRODUCT")
      .not("raw_easybill_payload->>note", "is", null)
      .not("raw_easybill_payload->>note", "eq", "")
      .order("raw_easybill_payload->>note" as any);

    if (notesError) throw notesError;

    // Normalisierung: Trim + Capitalize (erster Buchstabe groß, Rest klein)
    const nameSet = new Set<string>();
    for (const row of distinctNotes || []) {
      const rawName = (row as any).note;
      if (!rawName) continue;
      const normalized = rawName.trim();
      if (normalized) nameSet.add(normalized);
    }

    const manufacturerNames = Array.from(nameSet).sort();

    // 1b) Existierende Hersteller abfragen (um Duplikate zu vermeiden)
    const { data: existingManufacturers, error: existingError } = await admin
      .from("manufacturers")
      .select("name");

    if (existingError) throw existingError;

    const existingNames = new Set(
      (existingManufacturers || []).map((m) => m.name)
    );

    // 1c) Neue Hersteller anlegen
    const newNames = manufacturerNames.filter((n) => !existingNames.has(n));
    let manufacturersCreated = 0;

    if (newNames.length > 0) {
      const { error: insertError } = await admin
        .from("manufacturers")
        .insert(newNames.map((name) => ({ name })));

      if (insertError) throw insertError;
      manufacturersCreated = newNames.length;
    }

    // 1d) Alle Hersteller laden (inkl. neu angelegter)
    const { data: allManufacturers, error: allError } = await admin
      .from("manufacturers")
      .select("id, name");

    if (allError) throw allError;

    const manufacturerMap = new Map<string, string>();
    for (const m of allManufacturers || []) {
      manufacturerMap.set(m.name, m.id);
    }

    // 1e) Produkte verknüpfen
    // Wir holen alle Produkte mit Hersteller-Name, die noch keine manufacturer_id haben
    const { data: productsToLink, error: productsError } = await admin
      .from("products")
      .select("id, raw_easybill_payload->>note")
      .eq("type", "PRODUCT")
      .is("manufacturer_id", null)
      .not("raw_easybill_payload->>note", "is", null)
      .not("raw_easybill_payload->>note", "eq", "");

    if (productsError) throw productsError;

    let productsLinked = 0;
    const updates: { id: string; manufacturer_id: string }[] = [];

    for (const row of productsToLink || []) {
      const rawName = (row as any).note;
      if (!rawName) continue;
      const normalized = rawName.trim();
      const manufacturerId = manufacturerMap.get(normalized);
      if (manufacturerId) {
        updates.push({ id: row.id, manufacturer_id: manufacturerId });
      }
    }

    // Batch-Update (Supabase erlaubt keine echte Batch-Update, daher RPC)
    // Wir machen es in Chunks von 500
    const chunkSize = 500;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      const ids = chunk.map((u) => u.id);
      const manufacturerId = chunk[0].manufacturer_id; // Alle im Chunk haben denselben Hersteller

      const { error: updateError } = await admin
        .from("products")
        .update({ manufacturer_id: manufacturerId })
        .in(
          "id",
          ids
        );

      if (updateError) throw updateError;
      productsLinked += chunk.length;
    }

    // 1f) Artikel ohne Hersteller zählen
    const { count: withoutCount, error: countError } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("type", "PRODUCT")
      .is("manufacturer_id", null);

    if (countError) throw countError;

    revalidatePath("/verwaltung/hersteller");
    revalidatePath("/verwaltung/artikel");

    return {
      ok: true,
      data: {
        manufacturers_created: manufacturersCreated,
        manufacturers_skipped: manufacturerNames.length - manufacturersCreated,
        products_linked: productsLinked,
        products_without_manufacturer: withoutCount || 0,
      },
    };
  } catch (err) {
    console.error("Import-Hersteller-Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unbekannter Fehler beim Import.",
    };
  }
}

/* ═══════════════════════════════════════════
   2) Hersteller CRUD
   ═══════════════════════════════════════════ */

export async function getManufacturers(): Promise<
  { ok: true; data: Manufacturer[] } | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("manufacturers")
      .select("*")
      .order("name");

    if (error) throw error;

    // Artikel-Anzahl pro Hersteller holen
    const admin = createAdminClient();
    const { data: counts, error: countError } = await admin.rpc(
      "get_manufacturer_product_counts",
      {}
    );

    if (countError) {
      // Fallback: Manuelle Zählung
      const { data: products, error: prodError } = await admin
        .from("products")
        .select("manufacturer_id");

      if (prodError) throw prodError;

      const countMap = new Map<string, number>();
      for (const p of products || []) {
        if (p.manufacturer_id) {
          countMap.set(
            p.manufacturer_id,
            (countMap.get(p.manufacturer_id) || 0) + 1
          );
        }
      }

      const manufacturers = (data || []).map((m) => ({
        ...m,
        product_count: countMap.get(m.id) || 0,
      }));

      return { ok: true, data: manufacturers };
    }

    // Wenn RPC funktioniert
    const countMap = new Map<string, number>();
    if (Array.isArray(counts)) {
      for (const c of counts) {
        countMap.set(c.manufacturer_id, parseInt(c.count, 10));
      }
    }

    const manufacturers = (data || []).map((m) => ({
      ...m,
      product_count: countMap.get(m.id) || 0,
    }));

    return { ok: true, data: manufacturers };
  } catch (err) {
    console.error("Hersteller laden Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Laden der Hersteller.",
    };
  }
}

export async function createManufacturer(
  name: string,
  notes?: string
): Promise<
  { ok: true; data: Manufacturer } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, error: "Hersteller-Name ist erforderlich." };
  }

  try {
    const admin = createAdminClient();

    // Prüfen ob Name schon existiert
    const { data: existing } = await admin
      .from("manufacturers")
      .select("id")
      .eq("name", trimmedName)
      .single();

    if (existing) {
      return { ok: false, error: `Hersteller "${trimmedName}" existiert bereits.` };
    }

    const { data, error } = await admin
      .from("manufacturers")
      .insert({ name: trimmedName, notes: notes?.trim() || null })
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/verwaltung/hersteller");
    revalidatePath("/verwaltung/artikel");

    return {
      ok: true,
      data: { ...data, product_count: 0 },
    };
  } catch (err) {
    console.error("Hersteller anlegen Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Anlegen.",
    };
  }
}

export async function updateManufacturer(
  id: string,
  name: string,
  notes?: string
): Promise<
  { ok: true; data: Manufacturer } | { ok: false; error: string }
> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, error: "Hersteller-Name ist erforderlich." };
  }

  try {
    const admin = createAdminClient();

    // Prüfen ob Name schon bei anderem Hersteller existiert
    const { data: existing } = await admin
      .from("manufacturers")
      .select("id")
      .eq("name", trimmedName)
      .neq("id", id)
      .single();

    if (existing) {
      return { ok: false, error: `Hersteller "${trimmedName}" existiert bereits.` };
    }

    const { data, error } = await admin
      .from("manufacturers")
      .update({ name: trimmedName, notes: notes?.trim() || null })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/verwaltung/hersteller");
    revalidatePath("/verwaltung/artikel");

    return {
      ok: true,
      data: { ...data, product_count: 0 },
    };
  } catch (err) {
    console.error("Hersteller aktualisieren Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Aktualisieren.",
    };
  }
}

export async function deleteManufacturer(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  try {
    const admin = createAdminClient();

    // Prüfen ob Artikel verknüpft sind
    const { count, error: countError } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("manufacturer_id", id);

    if (countError) throw countError;

    if ((count || 0) > 0) {
      return {
        ok: false,
        error: `Hersteller kann nicht gelöscht werden — ${count} Artikel sind noch verknüpft.`,
      };
    }

    const { error } = await admin
      .from("manufacturers")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/verwaltung/hersteller");
    revalidatePath("/verwaltung/artikel");

    return { ok: true };
  } catch (err) {
    console.error("Hersteller löschen Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Löschen.",
    };
  }
}

/* ═══════════════════════════════════════════
   3) Artikel mit Hersteller
   ═══════════════════════════════════════════ */

export async function getProducts(filters?: {
  manufacturerId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  {
    ok: true;
    data: ProductWithManufacturer[];
    total: number;
  } | { ok: false; error: string }
> {
  try {
    const supabase = await createClient();
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("products")
      .select("id, number, description, manufacturer_id, type", {
        count: "exact",
      })
      .eq("type", "PRODUCT")
      .range(offset, offset + pageSize - 1);

    if (filters?.manufacturerId) {
      query = query.eq("manufacturer_id", filters.manufacturerId);
    } else if (filters?.manufacturerId === null) {
      query = query.is("manufacturer_id", null);
    }

    if (filters?.search) {
      query = query.or(
        `number.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) throw error;

    // Hersteller-Namen holen
    const manufacturerIds = [
      ...new Set((data || []).map((p) => p.manufacturer_id).filter(Boolean)),
    ];

    let nameMap = new Map<string, string>();
    if (manufacturerIds.length > 0) {
      const { data: manufacturers } = await supabase
        .from("manufacturers")
        .select("id, name")
        .in("id", manufacturerIds);

      for (const m of manufacturers || []) {
        nameMap.set(m.id, m.name);
      }
    }

    const products = (data || []).map((p) => ({
      ...p,
      manufacturer_name: nameMap.get(p.manufacturer_id || "") || null,
    }));

    return {
      ok: true,
      data: products,
      total: count || 0,
    };
  } catch (err) {
    console.error("Artikel laden Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Laden der Artikel.",
    };
  }
}

export async function updateProductManufacturer(
  productId: string,
  manufacturerId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from("products")
      .update({ manufacturer_id: manufacturerId })
      .eq("id", productId);

    if (error) throw error;

    revalidatePath("/verwaltung/artikel");

    return { ok: true };
  } catch (err) {
    console.error("Artikel-Hersteller-Zuordnung Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Zuordnen.",
    };
  }
}

export async function bulkUpdateProductManufacturers(
  productIds: string[],
  manufacturerId: string | null
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  if (!(await requireAdmin())) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  if (productIds.length === 0) {
    return { ok: true, updated: 0 };
  }

  try {
    const admin = createAdminClient();

    const { error } = await admin
      .from("products")
      .update({ manufacturer_id: manufacturerId })
      .in("id", productIds);

    if (error) throw error;

    revalidatePath("/verwaltung/artikel");

    return { ok: true, updated: productIds.length };
  } catch (err) {
    console.error("Bulk-Zuordnung Fehler:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fehler beim Zuordnen.",
    };
  }
}
