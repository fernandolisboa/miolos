import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { archiveCalendarMonth } from "../src/archive/calendar";

describe("the archive calendar model (T-WEB-S310)", () => {
  it("marks exactly the published dates linked, every other in-month day inert", () => {
    const { month, cells } = archiveCalendarMonth(
      "2026-08",
      new Set(["2026-08-01", "2026-08-13"]),
    );

    expect(month).toBe("2026-08-01");
    const days = cells.filter((cell) => cell !== null);
    expect(days).toHaveLength(31);

    expect(days.map((cell) => cell.date)).toEqual(
      Array.from(
        { length: 31 },
        (_, index) => `2026-08-${String(index + 1).padStart(2, "0")}`,
      ),
    );
    expect(days.filter((cell) => cell.linked).map((cell) => cell.date)).toEqual(
      ["2026-08-01", "2026-08-13"],
    );
  });

  it("a killed or ragged day goes inert by ABSENCE — no second code path", () => {
    const before = archiveCalendarMonth(
      "2026-08",
      new Set(["2026-08-01", "2026-08-02"]),
    );

    const after = archiveCalendarMonth("2026-08", new Set(["2026-08-01"]));

    const cellFor = (
      cells: typeof before.cells,
      date: string,
    ): { date: string; linked: boolean } => {
      const cell = cells.find((entry) => entry?.date === date);
      if (cell === null || cell === undefined) {
        throw new Error(`no cell for ${date}`);
      }
      return cell;
    };
    expect(cellFor(before.cells, "2026-08-02").linked).toBe(true);
    expect(cellFor(after.cells, "2026-08-02").linked).toBe(false);

    expect(before.cells.length).toBe(after.cells.length);
    expect(cellFor(after.cells, "2026-08-01").linked).toBe(true);
  });

  it("February's bounds are the month's own: no 2026-02-29 cell, a 2028-02-29 one", () => {
    const plain = archiveCalendarMonth("2026-02", new Set());
    expect(plain.cells.some((cell) => cell?.date === "2026-02-29")).toBe(false);
    expect(plain.cells.filter((cell) => cell !== null)).toHaveLength(28);

    const leap = archiveCalendarMonth("2028-02", new Set());
    expect(leap.cells.some((cell) => cell?.date === "2028-02-29")).toBe(true);

    const poisoned = archiveCalendarMonth("2026-02", new Set(["2026-03-01"]));
    expect(poisoned.cells.every((cell) => cell === null || !cell.linked)).toBe(
      true,
    );
  });

  it("reads no clock — 'is this day past' is never this module's question", () => {
    const code = (source: string): string =>
      source
        .replaceAll(/\/\*[\s\S]*?\*\//g, "")
        .replaceAll(/^[ \t]*\/\/.*$/gm, "");

    expect(code("// todaySaoPauloDate()")).not.toContain("todaySaoPauloDate");
    expect(code("/* new Date */")).not.toContain("new Date");
    expect(code("const d = todaySaoPauloDate();")).toContain(
      "todaySaoPauloDate",
    );

    const source = code(
      readFileSync(
        join(import.meta.dirname, "..", "src", "archive", "calendar.ts"),
        "utf8",
      ),
    );
    // An emptied module would satisfy every `not.toContain` below.
    expect(source).toContain("export function archiveCalendarMonth");
    expect(source.length).toBeGreaterThan(200);
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("new Date");
    expect(source).not.toContain("todaySaoPauloDate");
    expect(source).not.toContain("sao-paulo-day");
  });
});
