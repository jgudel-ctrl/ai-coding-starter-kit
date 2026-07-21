import { describe, it, expect } from "vitest";
import { parseExtractionResponse } from "./wissensbasis-helpers";

describe("parseExtractionResponse", () => {
  it("parst ein sauberes JSON-Array", () => {
    const text = JSON.stringify([
      {
        title: "Rohdichte",
        tool_type: "Säge",
        material: "Holz",
        technical_values: [{ label: "Bereich", value: "100–1200 kg/m³" }],
        description: "Dichteres Holz belastet die Schneide stärker.",
        verbatim_excerpt: "…erhöht sich mit der Rohdichte…",
        source_page: "3",
      },
    ]);
    const res = parseExtractionResponse(text);
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("Rohdichte");
    expect(res[0].technical_values[0].value).toBe("100–1200 kg/m³");
  });

  it("entfernt ```json-Fences und Vor-/Nachtext", () => {
    const text = 'Hier die Einträge:\n```json\n[{"title":"Test"}]\n```\nFertig.';
    const res = parseExtractionResponse(text);
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("Test");
    // Defaults gesetzt
    expect(res[0].tool_type).toBe("");
    expect(res[0].technical_values).toEqual([]);
  });

  it("verwirft ungültige Elemente (ohne title), behält gültige", () => {
    const text = JSON.stringify([{ title: "OK" }, { material: "Holz" }, { title: "" }]);
    const res = parseExtractionResponse(text);
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("OK");
  });

  it("wirft, wenn gar kein Array gefunden wird", () => {
    expect(() => parseExtractionResponse("Ich konnte nichts finden.")).toThrow();
  });

  it("rettet vollständige Einträge, wenn die Antwort abgeschnitten ist (max_tokens)", () => {
    // Array ohne schließendes "]" und mit halb abgeschnittenem letztem Objekt.
    const truncated =
      '[{"title":"Erster","material":"Holz"},{"title":"Zweiter","material":"Alumi';
    const res = parseExtractionResponse(truncated);
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("Erster");
  });
});
