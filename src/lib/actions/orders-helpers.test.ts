import { describe, it, expect } from "vitest";
import { buildGroupStats, escapeOrFilterValue } from "./orders-helpers";

describe("escapeOrFilterValue", () => {
  it("leaves plain text untouched", () => {
    expect(escapeOrFilterValue("Sägeblatt")).toBe("Sägeblatt");
  });

  it("escapes double quotes so they cannot close the quoted filter value early", () => {
    expect(escapeOrFilterValue('x"y')).toBe('x\\"y');
  });

  it("escapes backslashes", () => {
    expect(escapeOrFilterValue("a\\b")).toBe("a\\\\b");
  });

  it("leaves comma and parenthesis untouched (harmless inside a quoted value)", () => {
    expect(escapeOrFilterValue("a,b)c(d")).toBe("a,b)c(d");
  });
});

describe("buildGroupStats", () => {
  it("counts positions per group and sorts descending by count", () => {
    const numberToGroup = new Map([
      ["A1", { group_id: 1, group_name: "HW Sägeblatt" }],
      ["A2", { group_id: 1, group_name: "HW Sägeblatt" }],
      ["B1", { group_id: 2, group_name: "Bohrer" }],
    ]);

    const stats = buildGroupStats(["A1", "A1", "A2", "B1"], numberToGroup);

    expect(stats).toEqual([
      { group_id: 1, group_name: "HW Sägeblatt", count: 3 },
      { group_id: 2, group_name: "Bohrer", count: 1 },
    ]);
  });

  it("excludes article numbers with no matching product", () => {
    const numberToGroup = new Map([["A1", { group_id: 1, group_name: "HW Sägeblatt" }]]);

    const stats = buildGroupStats(["A1", "UNKNOWN", null], numberToGroup);

    expect(stats).toEqual([{ group_id: 1, group_name: "HW Sägeblatt", count: 1 }]);
  });

  it("excludes products that have no group assigned", () => {
    const numberToGroup = new Map([
      ["A1", { group_id: 1, group_name: "HW Sägeblatt" }],
      ["B1", { group_id: null, group_name: null }],
    ]);

    const stats = buildGroupStats(["A1", "B1"], numberToGroup);

    expect(stats).toEqual([{ group_id: 1, group_name: "HW Sägeblatt", count: 1 }]);
  });

  it("returns an empty array when no article numbers qualify", () => {
    expect(buildGroupStats([], new Map())).toEqual([]);
  });
});
