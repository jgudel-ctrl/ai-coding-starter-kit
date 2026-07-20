"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/supabase/server";
import { canManageContent } from "@/lib/roles";
import { escapeOrFilterValue } from "./orders-helpers";
import { EXTRACTION_PROMPT, parseExtractionResponse } from "./wissensbasis-helpers";

/** PROJ-29 — Wissensbasis: Server Actions (DB, Storage, KI-Extraktion). */

export type KnowledgeStatus = "entwurf" | "geprueft";
export type TechnicalValue = { label: string; value: string };
export type KnowledgeSource = { manufacturer: string; document: string; page: string };

export type KnowledgeEntry = {
  id: string;
  title: string;
  tool_type: string;
  material: string;
  technical_values: TechnicalValue[];
  description: string;
  verbatim_excerpt: string;
  source: KnowledgeSource;
  status: KnowledgeStatus;
  created_at: string;
  updated_at: string;
};

export type KnowledgeCategories = { toolTypes: string[]; materials: string[] };
export type KnowledgeFilters = {
  search?: string;
  toolType?: string;
  material?: string;
  status?: KnowledgeStatus;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const BUCKET = "wissensbasis";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const FORBIDDEN = "Kein Zugriff (nur Redaktion/Admin).";

/** Prüft, ob der aktuelle Nutzer Content verwalten darf. */
async function requireContentManager(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return !!profile?.roles && canManageContent(profile.roles);
}

// DB-Zeile → Client-Typ (Quelle wird verschachtelt).
function mapRow(r: Record<string, unknown>): KnowledgeEntry {
  return {
    id: String(r.id),
    title: (r.title as string) ?? "",
    tool_type: (r.tool_type as string) ?? "",
    material: (r.material as string) ?? "",
    technical_values: Array.isArray(r.technical_values)
      ? (r.technical_values as TechnicalValue[])
      : [],
    description: (r.description as string) ?? "",
    verbatim_excerpt: (r.verbatim_excerpt as string) ?? "",
    source: {
      manufacturer: (r.source_manufacturer as string) ?? "",
      document: (r.source_document as string) ?? "",
      page: (r.source_page as string) ?? "",
    },
    status: (r.status as KnowledgeStatus) ?? "entwurf",
    created_at: (r.created_at as string) ?? "",
    updated_at: (r.updated_at as string) ?? "",
  };
}

export async function getKnowledgeEntries(
  filters?: KnowledgeFilters
): Promise<Result<KnowledgeEntry[]>> {
  if (!(await requireContentManager())) return { ok: false, error: FORBIDDEN };
  const supabase = createAdminClient({ schema: "tms" });

  let query = supabase
    .from("knowledge_entries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.toolType) query = query.eq("tool_type", filters.toolType);
  if (filters?.material) query = query.eq("material", filters.material);
  if (filters?.search) {
    const s = escapeOrFilterValue(filters.search);
    query = query.or(
      `title.ilike."%${s}%",description.ilike."%${s}%",source_document.ilike."%${s}%"`
    );
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data || []).map((r) => mapRow(r as Record<string, unknown>)) };
}

export async function getKnowledgeCategories(): Promise<Result<KnowledgeCategories>> {
  if (!(await requireContentManager())) return { ok: false, error: FORBIDDEN };
  const supabase = createAdminClient({ schema: "tms" });
  const { data, error } = await supabase
    .from("knowledge_categories")
    .select("kind, name")
    .order("name");
  if (error) return { ok: false, error: error.message };
  const toolTypes = (data || []).filter((c) => c.kind === "werkzeugart").map((c) => c.name);
  const materials = (data || []).filter((c) => c.kind === "material").map((c) => c.name);
  return { ok: true, data: { toolTypes, materials } };
}

export async function saveKnowledgeEntry(
  entry: Partial<KnowledgeEntry>
): Promise<Result<KnowledgeEntry>> {
  if (!(await requireContentManager())) return { ok: false, error: FORBIDDEN };
  if (!entry.title?.trim()) return { ok: false, error: "Titel ist erforderlich." };

  const supabase = createAdminClient({ schema: "tms" });
  const row = {
    title: entry.title.trim(),
    tool_type: entry.tool_type || null,
    material: entry.material || null,
    technical_values: entry.technical_values ?? [],
    description: entry.description ?? "",
    verbatim_excerpt: entry.verbatim_excerpt ?? "",
    source_manufacturer: entry.source?.manufacturer ?? "",
    source_document: entry.source?.document ?? "",
    source_page: entry.source?.page ?? "",
    updated_at: new Date().toISOString(),
  };

  const q = entry.id
    ? supabase.from("knowledge_entries").update(row).eq("id", entry.id).select("*").single()
    : supabase.from("knowledge_entries").insert(row).select("*").single();

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: mapRow(data as Record<string, unknown>) };
}

export async function setKnowledgeEntryStatus(
  id: string,
  status: KnowledgeStatus
): Promise<Result<null>> {
  if (!(await requireContentManager())) return { ok: false, error: FORBIDDEN };
  const supabase = createAdminClient({ schema: "tms" });

  if (status === "geprueft") {
    const { data: row } = await supabase
      .from("knowledge_entries")
      .select("tool_type, material")
      .eq("id", id)
      .single();
    if (!row?.tool_type || !row?.material) {
      return { ok: false, error: "Für „Geprüft“ müssen Werkzeugart und Material gesetzt sein." };
    }
  }

  const { error } = await supabase
    .from("knowledge_entries")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function deleteKnowledgeEntry(id: string): Promise<Result<null>> {
  if (!(await requireContentManager())) return { ok: false, error: FORBIDDEN };
  const supabase = createAdminClient({ schema: "tms" });
  const { error } = await supabase.from("knowledge_entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

/** PDF hochladen → in Storage ablegen → KI extrahiert Entwurfs-Einträge. */
export async function uploadKnowledgeDocument(
  formData: FormData
): Promise<Result<{ createdCount: number }>> {
  const profile = await getCurrentProfile();
  if (!profile?.roles || !canManageContent(profile.roles)) {
    return { ok: false, error: FORBIDDEN };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Keine Datei erhalten." };

  const supabase = createAdminClient({ schema: "tms" });
  const bytes = Buffer.from(await file.arrayBuffer());

  // 1) Datei in Storage
  const storagePath = `${crypto.randomUUID()}-${file.name}`;
  const up = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || "application/pdf" });
  if (up.error) return { ok: false, error: "Upload fehlgeschlagen: " + up.error.message };

  // 2) Dokument-Datensatz
  const { data: doc } = await supabase
    .from("knowledge_documents")
    .insert({ file_name: file.name, storage_path: storagePath, uploaded_by: profile.id })
    .select("id")
    .single();

  // 3) KI-Extraktion (key-ready)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Datei gespeichert, aber die KI-Extraktion ist noch nicht aktiv (ANTHROPIC_API_KEY fehlt). Bitte den Key hinterlegen.",
    };
  }

  let extracted;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: bytes.toString("base64"),
                },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      let msg = errText;
      try {
        msg = JSON.parse(errText)?.error?.message || errText;
      } catch {
        /* Rohtext behalten */
      }
      return { ok: false, error: "KI-Dienst-Fehler (" + res.status + "): " + msg.slice(0, 220) };
    }
    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    extracted = parseExtractionResponse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "KI-Extraktion fehlgeschlagen." };
  }

  // 4) Einträge als Entwurf anlegen
  if (extracted.length > 0) {
    const rows = extracted.map((e) => ({
      title: e.title,
      tool_type: e.tool_type || null,
      material: e.material || null,
      technical_values: e.technical_values,
      description: e.description,
      verbatim_excerpt: e.verbatim_excerpt,
      source_document: file.name,
      source_page: e.source_page,
      status: "entwurf" as const,
      document_id: doc?.id ?? null,
      created_by: profile.id,
    }));
    const ins = await supabase.from("knowledge_entries").insert(rows);
    if (ins.error) return { ok: false, error: "Speichern der Einträge fehlgeschlagen: " + ins.error.message };
  }

  return { ok: true, data: { createdCount: extracted.length } };
}
