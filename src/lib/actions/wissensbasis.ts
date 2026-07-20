"use server";

/**
 * PROJ-29 — Wissensbasis: Server Actions.
 *
 * ⚠️ GERÜST (Frontend-Schritt): Die Datenzugriffe/KI-Extraktion sind hier noch
 * als Stub mit Demo-Daten umgesetzt, damit die Oberfläche gebaut & reviewt werden
 * kann. Die echte Umsetzung (Supabase-Tabellen `tms.knowledge_entries` /
 * `tms.knowledge_categories`, PDF-Upload in Storage, KI-Extraktion via Claude,
 * RLS für Rolle „redaktion") folgt im `/backend`-Schritt.
 */

export type KnowledgeStatus = "entwurf" | "geprueft";

/** Ein technischer Kennwert, z.B. „Schnittgeschwindigkeit" → „40–60 m/s". */
export type TechnicalValue = { label: string; value: string };

/** Quelle eines Eintrags (Hersteller wird intern gespeichert, aber nie öffentlich gezeigt). */
export type KnowledgeSource = { manufacturer: string; document: string; page: string };

export type KnowledgeEntry = {
  id: string;
  title: string;
  tool_type: string; // Werkzeugart (z.B. Säge, Fräser, Bohrer)
  material: string; // Holz, Kunststoff, Aluminium
  technical_values: TechnicalValue[];
  description: string; // destilliert, eigene Worte
  verbatim_excerpt: string; // Originaltext-Auszug (intern)
  source: KnowledgeSource;
  status: KnowledgeStatus;
  created_at: string;
  updated_at: string;
};

export type KnowledgeCategories = {
  toolTypes: string[]; // Werkzeugarten
  materials: string[]; // Materialien
};

export type KnowledgeFilters = {
  search?: string;
  toolType?: string;
  material?: string;
  status?: KnowledgeStatus;
};

const DEMO_CATEGORIES: KnowledgeCategories = {
  toolTypes: ["Säge", "Fräser", "Bohrer"],
  materials: ["Holz", "Kunststoff", "Aluminium"],
};

// Demo-Einträge nur fürs Frontend-Review (werden im /backend-Schritt durch echte
// DB-Daten ersetzt).
const DEMO_ENTRIES: KnowledgeEntry[] = [
  {
    id: "demo-1",
    title: "Rohdichte und Werkzeugverschleiß",
    tool_type: "Säge",
    material: "Holz",
    technical_values: [
      { label: "Rohdichte-Bereich", value: "100–1200 kg/m³" },
      { label: "Faustregel", value: "höhere Dichte → höherer Verschleiß" },
    ],
    description:
      "Je dichter das Holz, desto stärker wird die Schneide bei jedem Zahneingriff belastet.",
    verbatim_excerpt:
      "Auch der Verschleiß an den Werkzeugen erhöht sich in erster Näherung mit der Rohdichte des Holzes.",
    source: { manufacturer: "—", document: "Anwenderlexikon", page: "3" },
    status: "geprueft",
    created_at: "2026-07-20T08:00:00.000Z",
    updated_at: "2026-07-20T08:00:00.000Z",
  },
  {
    id: "demo-2",
    title: "Silikateinschlüsse in Tropenhölzern",
    tool_type: "Fräser",
    material: "Holz",
    technical_values: [{ label: "Wirkung", value: "abrasiver Verschleiß (wie Schmirgel)" }],
    description:
      "Tropische Hölzer lagern Silikate ein, die die Schneide wie feiner Schmirgel abtragen.",
    verbatim_excerpt:
      "Silikateinschlüsse … erzeugen einen erhöhten abrasiven Verschleiß an den Werkzeugschneiden.",
    source: { manufacturer: "—", document: "Anwenderlexikon", page: "3" },
    status: "entwurf",
    created_at: "2026-07-20T08:05:00.000Z",
    updated_at: "2026-07-20T08:05:00.000Z",
  },
];

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const NOT_IMPLEMENTED =
  "Wird im Backend-Schritt umgesetzt (Datenbank + KI-Extraktion). Aktuell nur Vorschau.";

/** Alle Einträge (optional gefiltert) laden. */
export async function getKnowledgeEntries(
  filters?: KnowledgeFilters
): Promise<Result<KnowledgeEntry[]>> {
  // TODO(/backend): aus tms.knowledge_entries lesen (RLS: redaktion/admin).
  let entries = [...DEMO_ENTRIES];
  if (filters?.toolType) entries = entries.filter((e) => e.tool_type === filters.toolType);
  if (filters?.material) entries = entries.filter((e) => e.material === filters.material);
  if (filters?.status) entries = entries.filter((e) => e.status === filters.status);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.source.document.toLowerCase().includes(q)
    );
  }
  return { ok: true, data: entries };
}

/** Werkzeugart- und Material-Listen laden. */
export async function getKnowledgeCategories(): Promise<Result<KnowledgeCategories>> {
  // TODO(/backend): aus tms.knowledge_categories lesen.
  return { ok: true, data: DEMO_CATEGORIES };
}

/** PDF/Dokument hochladen → KI extrahiert Entwurfs-Einträge. */
export async function uploadKnowledgeDocument(
  _formData: FormData
): Promise<Result<{ createdCount: number }>> {
  // TODO(/backend): Datei in Supabase Storage + KI-Extraktion (Claude) →
  //                 mehrere Einträge im Status „entwurf" anlegen.
  return { ok: false, error: NOT_IMPLEMENTED };
}

/** Einen Eintrag speichern (anlegen/bearbeiten). */
export async function saveKnowledgeEntry(
  _entry: Partial<KnowledgeEntry>
): Promise<Result<KnowledgeEntry>> {
  // TODO(/backend): Insert/Update in tms.knowledge_entries.
  return { ok: false, error: NOT_IMPLEMENTED };
}

/** Status setzen (Entwurf → Geprüft bzw. zurück). */
export async function setKnowledgeEntryStatus(
  _id: string,
  _status: KnowledgeStatus
): Promise<Result<null>> {
  // TODO(/backend): Status-Update; „geprueft" erfordert Pflichtfelder.
  return { ok: false, error: NOT_IMPLEMENTED };
}

/** Einen Eintrag löschen/verwerfen. */
export async function deleteKnowledgeEntry(_id: string): Promise<Result<null>> {
  // TODO(/backend): Delete aus tms.knowledge_entries.
  return { ok: false, error: NOT_IMPLEMENTED };
}
