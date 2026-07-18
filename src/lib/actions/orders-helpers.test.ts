import { describe, it, expect } from "vitest";
import {
  buildGroupStats,
  centsToEuro,
  chunk,
  escapeOrFilterValue,
  rowQualifies,
  type ProductGroupInfo,
} from "./orders-helpers";

describe("centsToEuro", () => {
  it("converts integer cents to a euro amount", () => {
    expect(centsToEuro(1840)).toBe(18.4);
    expect(centsToEuro(7361)).toBe(73.61);
  });

  it("treats null/undefined/0 as 0", () => {
    expect(centsToEuro(null)).toBe(0);
    expect(centsToEuro(undefined)).toBe(0);
    expect(centsToEuro(0)).toBe(0);
  });
});

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

describe("chunk", () => {
  it("splits into blocks of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single block when smaller than the size", () => {
    expect(chunk([1, 2], 150)).toEqual([[1, 2]]);
  });

  it("returns an empty array for empty input", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("keeps the .in() URL short by never exceeding the block size", () => {
    const many = Array.from({ length: 500 }, (_, i) => `ART-${i}`);
    const blocks = chunk(many, 150);
    expect(blocks).toHaveLength(4);
    expect(Math.max(...blocks.map((b) => b.length))).toBe(150);
  });

  it("throws on a non-positive size", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("rowQualifies", () => {
  const map = new Map<string, ProductGroupInfo>([
    ["A1", { group_id: 1, group_name: "HW Sägeblatt" }],
    ["B1", { group_id: 2, group_name: "Bohrer" }],
    ["NOGRP", { group_id: null, group_name: null }],
  ]);

  it("hides positions with no product match (kein Match = keine Anzeige)", () => {
    expect(rowQualifies("UNKNOWN", map)).toBe(false);
    expect(rowQualifies(null, map)).toBe(false);
  });

  it("shows a matching product when no group filter is active", () => {
    expect(rowQualifies("A1", map)).toBe(true);
  });

  it("keeps a grouped product visible without a filter but hidden under a different group", () => {
    expect(rowQualifies("A1", map, 1)).toBe(true);
    expect(rowQualifies("A1", map, 2)).toBe(false);
  });

  it("shows a product without a group only when no group filter is active", () => {
    expect(rowQualifies("NOGRP", map)).toBe(true);
    expect(rowQualifies("NOGRP", map, 1)).toBe(false);
  });
});
