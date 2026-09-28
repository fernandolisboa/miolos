import { describe, expect, it } from "vitest";

import {
  CROSSWORD_SIZE,
  CROSSWORD_TEMPLATES,
} from "../../src/crossword/templates";

function runLengths(line: string): number[] {
  return line
    .split("#")
    .filter((run) => run !== "")
    .map((run) => run.length);
}

function isShippableShape(rows: readonly string[]): boolean {
  const wellFormed =
    rows.length === CROSSWORD_SIZE &&
    rows.every((row) => row.length === CROSSWORD_SIZE && /^[#.]+$/.test(row));
  if (!wellFormed) {
    return false;
  }
  const columns = rows.map((_, c) => rows.map((row) => row[c]).join(""));
  return [...rows, ...columns]
    .flatMap(runLengths)
    .every((length) => length >= 3 && length <= CROSSWORD_SIZE);
}

describe("crossword templates", () => {
  it("every shipped template passes the shape test", () => {
    expect(CROSSWORD_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of CROSSWORD_TEMPLATES) {
      expect(isShippableShape(template), template.join("/")).toBe(true);
    }
  });

  it("templates are distinct", () => {
    const keys = CROSSWORD_TEMPLATES.map((template) => template.join("/"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("the shape test rejects the diamond, whose edge cells are unchecked", () => {
    expect(
      isShippableShape(["##.##", "#...#", ".....", "#...#", "##.##"]),
    ).toBe(false);
  });

  it("the shape test rejects a two-letter run", () => {
    expect(
      isShippableShape([".....", ".....", ".....", ".....", "###.."]),
    ).toBe(false);
  });

  it("the shape test rejects a malformed grid", () => {
    expect(isShippableShape(["....", ".....", ".....", ".....", "....."])).toBe(
      false,
    );
    expect(
      isShippableShape(["....x", ".....", ".....", ".....", "....."]),
    ).toBe(false);
  });
});
