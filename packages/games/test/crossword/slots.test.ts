import { describe, expect, it } from "vitest";

import { generateCrossword } from "../../src/crossword/generate";
import { deriveSlots } from "../../src/crossword/slots";
import { toBlocks } from "../../src/crossword/templates";
import type { CrosswordSlot } from "../../src/crossword/types";
import { validateCrossword } from "../../src/crossword/validate";

function across(
  number: number,
  row: number,
  col: number,
  length: number,
): CrosswordSlot {
  return { number, direction: "across", row, col, length };
}

function down(
  number: number,
  row: number,
  col: number,
  length: number,
): CrosswordSlot {
  return { number, direction: "down", row, col, length };
}

describe("deriveSlots — hand-numbered fixtures, on which validateCrossword's independence rests", () => {
  it("numbers the stair template row-major, across then down", () => {
    const blocks = toBlocks(["##...", "#....", ".....", "....#", "...##"]);
    expect(deriveSlots(blocks)).toEqual([
      across(1, 0, 2, 3),
      across(4, 1, 1, 4),
      across(5, 2, 0, 5),
      across(6, 3, 0, 4),
      across(7, 4, 0, 3),
      down(1, 0, 2, 5),
      down(2, 0, 3, 4),
      down(3, 0, 4, 3),
      down(4, 1, 1, 4),
      down(5, 2, 0, 3),
    ]);
  });

  it("numbers the four-corner template, including a down-only start", () => {
    const blocks = toBlocks(["#...#", ".....", ".....", ".....", "#...#"]);
    expect(deriveSlots(blocks)).toEqual([
      across(1, 0, 1, 3),
      across(4, 1, 0, 5),
      across(6, 2, 0, 5),
      across(7, 3, 0, 5),
      across(8, 4, 1, 3),
      down(1, 0, 1, 5),
      down(2, 0, 2, 5),
      down(3, 0, 3, 5),
      down(4, 1, 0, 3),
      down(5, 1, 4, 3),
    ]);
  });

  it("keeps two-cell runs and skips one-cell runs", () => {
    expect(deriveSlots(toBlocks(["..#", "...", "#.."]))).toEqual([
      across(1, 0, 0, 2),
      across(3, 1, 0, 3),
      across(5, 2, 1, 2),
      down(1, 0, 0, 2),
      down(2, 0, 1, 3),
      down(4, 1, 2, 2),
    ]);
    expect(deriveSlots(toBlocks([".#.", "...", ".#."]))).toEqual([
      across(3, 1, 0, 3),
      down(1, 0, 0, 3),
      down(2, 0, 2, 3),
    ]);
  });
});

describe("validateCrossword against the numbering", () => {
  const puzzle = generateCrossword(1);

  it("rejects a puzzle missing one slot's entry", () => {
    const verdict = validateCrossword({
      ...puzzle,
      entries: puzzle.entries.slice(1),
    });
    expect(verdict.failures).toContain("entries-mismatch");
  });

  it("rejects a misnumbered entry", () => {
    const entries = puzzle.entries.map((entry, index) =>
      index === 0 ? { ...entry, number: entry.number + 1 } : entry,
    );
    expect(validateCrossword({ ...puzzle, entries }).failures).toEqual([
      "entries-mismatch",
    ]);
  });
});
