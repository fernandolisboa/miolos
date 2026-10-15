import { describe, expect, it } from "vitest";

import { CROSSWORD_TEMPLATES } from "../../src/crossword/templates";
import type { CrosswordSize } from "../../src/crossword/types";

const SIZES: readonly CrosswordSize[] = [5, 7];

function runLengths(line: string): number[] {
  return line
    .split("#")
    .filter((run) => run !== "")
    .map((run) => run.length);
}

function isShippableShape(rows: readonly string[], size: number): boolean {
  const wellFormed =
    rows.length === size &&
    rows.every((row) => row.length === size && /^[#.]+$/.test(row));
  if (!wellFormed) {
    return false;
  }
  const columns = rows.map((_, c) => rows.map((row) => row[c]).join(""));
  return [...rows, ...columns]
    .flatMap(runLengths)
    .every((length) => length >= 3 && length <= size);
}

describe("crossword templates", () => {
  it("the templates are keyed by exactly the shipped sizes", () => {
    expect(Object.keys(CROSSWORD_TEMPLATES).map(Number)).toEqual(SIZES);
  });

  it.each(SIZES)(
    "every shipped template of side %i passes the shape test",
    (size) => {
      const templates = CROSSWORD_TEMPLATES[size];
      expect(templates.length).toBeGreaterThan(0);
      for (const template of templates) {
        expect(isShippableShape(template, size), template.join("/")).toBe(true);
      }
    },
  );

  it.each(SIZES)("the templates of side %i are distinct", (size) => {
    const keys = CROSSWORD_TEMPLATES[size].map((template) =>
      template.join("/"),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("the shape test rejects the diamond, whose edge cells are unchecked", () => {
    expect(
      isShippableShape(["##.##", "#...#", ".....", "#...#", "##.##"], 5),
    ).toBe(false);
  });

  it("the shape test rejects a two-letter run", () => {
    expect(
      isShippableShape([".....", ".....", ".....", ".....", "###.."], 5),
    ).toBe(false);
    expect(
      isShippableShape(
        [
          ".......",
          ".......",
          ".......",
          ".......",
          ".......",
          ".......",
          "#####..",
        ],
        7,
      ),
    ).toBe(false);
  });

  it("the shape test rejects a malformed grid", () => {
    expect(
      isShippableShape(["....", ".....", ".....", ".....", "....."], 5),
    ).toBe(false);
    expect(
      isShippableShape(["....x", ".....", ".....", ".....", "....."], 5),
    ).toBe(false);
    expect(
      isShippableShape([".....", ".....", ".....", ".....", "....."], 7),
    ).toBe(false);
  });
});
