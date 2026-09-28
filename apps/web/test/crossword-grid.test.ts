import { describe, expect, it } from "vitest";

import {
  activeEntry,
  CELL_COUNT,
  colOf,
  countAnswered,
  entryAt,
  entryCells,
  firstPlayableIndex,
  flattenGrid,
  indexOf,
  isBlock,
  isSolved,
  nextCellInEntry,
  prevCellInEntry,
  rowOf,
  type CrosswordClue,
} from "../src/crossword/grid";

// row0: c a t # #
// row1: a # o # #
// rows 2-4: all blocks
const NESTED_GRID: readonly (readonly (string | null)[])[] = [
  ["c", "a", "t", null, null],
  ["a", null, "o", null, null],
  [null, null, null, null, null],
  [null, null, null, null, null],
  [null, null, null, null, null],
];

const ACROSS_1: CrosswordClue = {
  number: 1,
  direction: "across",
  row: 0,
  col: 0,
  length: 3,
  clue: "felino",
};

const DOWN_1: CrosswordClue = {
  number: 1,
  direction: "down",
  row: 0,
  col: 0,
  length: 2,
  clue: "pronome",
};

const DOWN_2: CrosswordClue = {
  number: 2,
  direction: "down",
  row: 0,
  col: 2,
  length: 2,
  clue: "verbo",
};

const CLUES = [ACROSS_1, DOWN_1, DOWN_2];

describe("indices (T-WEB-S425)", () => {
  it("round-trips row/col through indexOf, and CELL_COUNT is 25", () => {
    expect(CELL_COUNT).toBe(25);
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const index = indexOf(row, col);
        expect(rowOf(index)).toBe(row);
        expect(colOf(index)).toBe(col);
      }
    }
  });

  it("flattens the nested daily grid row-major", () => {
    expect(flattenGrid(NESTED_GRID)).toEqual([
      "c",
      "a",
      "t",
      null,
      null,
      "a",
      null,
      "o",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("entry membership (T-WEB-S425)", () => {
  it("lists an across entry's cells left to right", () => {
    expect(entryCells(ACROSS_1)).toEqual([0, 1, 2]);
  });

  it("lists a down entry's cells top to bottom", () => {
    expect(entryCells(DOWN_2)).toEqual([2, 7]);
  });

  it("finds the entry at a cell in a given direction, or undefined", () => {
    expect(entryAt(CLUES, 0, "across")).toBe(ACROSS_1);
    expect(entryAt(CLUES, 0, "down")).toBe(DOWN_1);
    expect(entryAt(CLUES, 1, "down")).toBeUndefined();
  });

  it("falls back to the other direction when the cell has no entry there", () => {
    expect(activeEntry(CLUES, 1, "down")).toBe(ACROSS_1);
    expect(activeEntry(CLUES, 0, "across")).toBe(ACROSS_1);
  });

  it("steps to the next and previous cell inside an entry, clamped at its ends", () => {
    expect(nextCellInEntry(ACROSS_1, 0)).toBe(1);
    expect(nextCellInEntry(ACROSS_1, 2)).toBeUndefined();
    expect(prevCellInEntry(ACROSS_1, 1)).toBe(0);
    expect(prevCellInEntry(ACROSS_1, 0)).toBeUndefined();
    expect(nextCellInEntry(ACROSS_1, 99)).toBeUndefined();
  });
});

describe("blocks and completion (T-WEB-S425)", () => {
  const solution = flattenGrid(NESTED_GRID);

  it("treats a null solution cell as a block, and a letter cell as playable", () => {
    expect(isBlock(solution, 0)).toBe(false);
    expect(isBlock(solution, 3)).toBe(true);
  });

  it("is solved only once every white cell matches the solution", () => {
    const empty = solution.map(() => null);
    expect(isSolved(solution, empty)).toBe(false);

    const entries = solution.map((cell, index) => (index === 5 ? "x" : cell));
    expect(isSolved(solution, entries)).toBe(false);
    expect(isSolved(solution, [...solution])).toBe(true);
  });

  it("counts only the white cells that have a letter", () => {
    const entries = solution.map(() => null);
    expect(countAnswered(solution, entries)).toBe(0);
    expect(countAnswered(solution, [...solution])).toBe(5);
  });

  it("finds the first playable cell, skipping leading blocks", () => {
    const leadingBlocks = [null, null, "a", null, null] as const;
    expect(firstPlayableIndex(leadingBlocks)).toBe(2);
    expect(firstPlayableIndex([null, null])).toBe(0);
  });
});
