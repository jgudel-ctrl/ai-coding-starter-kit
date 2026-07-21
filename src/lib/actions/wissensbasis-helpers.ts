import { z } from "zod";

/**
 * PROJ-29 — reine Helfer für die KI-Extraktion (ohne Netzwerk/DB), damit sie
 * unit-getestet werden können.
 */

/** Prompt für die KI: aus einem PDF Wissens-Einträge (Themenblöcke) extrahieren. */
export const EXTRACTION_PROMPT = `Du bist ein Fachredakteur für Holzwerkstoff-Zerspanung.
Extrahiere aus dem beigefügten Dokument einzelne, in sich abgeschlossene WISSENS-EINTRÄGE
(Themenblöcke) — ausschließlich zu Zerspanungswerkzeugen (Sägen, Fräser, Bohrer) und den
Materialien Holz, Kunststoff, Aluminium.

Gib AUSSCHLIESSLICH ein JSON-Array zurück (kein Fließtext, keine Erklärung). Jedes Element:
{
  "title": "kurzer, prägnanter Begriff/Thementitel",
  "tool_type": "Säge" | "Fräser" | "Bohrer" | "",   // leer, wenn nicht eindeutig
  "material": "Holz" | "Kunststoff" | "Aluminium" | "",
  "technical_values": [ { "label": "Bezeichnung", "value": "Wert mit Einheit" } ],
  "description": "1–3 Sätze in EIGENEN Worten (destilliert, nicht wörtlich kopiert)",
  "verbatim_excerpt": "kurzer wörtlicher Original-Auszug als interne Referenz",
  "source_page": "Seitenzahl im Dokument, falls erkennbar, sonst leer"
}

WICHTIG:
- Nenne NIEMALS einen Hersteller-/Markennamen. Bleibe neutral.
- Erfinde keine Werte. Nur, was im Dokument steht.
- Nur relevante Themen; irrelevante Seiten überspringen.`;

const ExtractedEntrySchema = z.object({
  title: z.string().min(1),
  tool_type: z.string().default(""),
  material: z.string().default(""),
  technical_values: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .default([]),
  description: z.string().default(""),
  verbatim_excerpt: z.string().default(""),
  source_page: z.string().default(""),
});

export type ExtractedEntry = z.infer<typeof ExtractedEntrySchema>;

/**
 * Zieht das JSON-Array aus einer KI-Textantwort (auch wenn es in ```json-Fences
 * oder mit Vor-/Nachtext kommt), parst und validiert es. Ungültige Elemente
 * werden verworfen. Wirft nur, wenn gar kein JSON-Array gefunden wird.
 */
export function parseExtractionResponse(text: string): ExtractedEntry[] {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

  let raw: unknown;
  try {
    raw = JSON.parse(cleaned);
  } catch {
    // Fallback 1: erstes JSON-Array im Text suchen
    const start = cleaned.indexOf("[");
    if (start === -1) {
      throw new Error("Keine verwertbaren Einträge in der KI-Antwort gefunden.");
    }
    const end = cleaned.lastIndexOf("]");
    let parsed = false;
    if (end > start) {
      try {
        raw = JSON.parse(cleaned.slice(start, end + 1));
        parsed = true;
      } catch {
        /* evtl. abgeschnitten → Fallback 2 */
      }
    }
    if (!parsed) {
      // Fallback 2: Antwort wurde abgeschnitten (max_tokens). Vollständige
      // Objekte bis zum letzten schließenden "}" retten und Array selbst schließen.
      const lastObj = cleaned.lastIndexOf("}");
      if (lastObj <= start) {
        throw new Error("Keine verwertbaren Einträge in der KI-Antwort gefunden.");
      }
      raw = JSON.parse(cleaned.slice(start, lastObj + 1) + "]");
    }
  }

  if (!Array.isArray(raw)) {
    throw new Error("KI-Antwort war kein Einträge-Array.");
  }

  const entries: ExtractedEntry[] = [];
  for (const item of raw) {
    const parsed = ExtractedEntrySchema.safeParse(item);
    if (parsed.success) entries.push(parsed.data);
  }
  return entries;
}
