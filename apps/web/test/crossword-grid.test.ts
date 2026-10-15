import { describe, expect, it } from "vitest";

import {
  activeEntry,
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
  nextEmptyCell,
  prevCellInEntry,
  rowOf,
  type CrosswordClue,
} from "../src/crossword/grid";
import { SEVEN_DAILY } from "./crossword-seven";

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
  it.each([5, 7])(
    "round-trips row/col through indexOf on a %i-wide grid, row-major",
    (size) => {
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const index = indexOf(row, col, size);
          expect(index).toBe(row * size + col);
          expect(rowOf(index, size)).toBe(row);
          expect(colOf(index, size)).toBe(col);
        }
      }
    },
  );

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
    expect(entryCells(ACROSS_1, 5)).toEqual([0, 1, 2]);
  });

  it("lists a down entry's cells top to bottom", () => {
    expect(entryCells(DOWN_2, 5)).toEqual([2, 7]);
  });

  it("finds the entry at a cell in a given direction, or undefined", () => {
    expect(entryAt(CLUES, 0, "across", 5)).toBe(ACROSS_1);
    expect(entryAt(CLUES, 0, "down", 5)).toBe(DOWN_1);
    expect(entryAt(CLUES, 1, "down", 5)).toBeUndefined();
  });

  it("falls back to the other direction when the cell has no entry there", () => {
    expect(activeEntry(CLUES, 1, "down", 5)).toBe(ACROSS_1);
    expect(activeEntry(CLUES, 0, "across", 5)).toBe(ACROSS_1);
  });

  it("steps to the next and previous cell inside an entry, clamped at its ends", () => {
    expect(nextCellInEntry(ACROSS_1, 0, 5)).toBe(1);
    expect(nextCellInEntry(ACROSS_1, 2, 5)).toBeUndefined();
    expect(prevCellInEntry(ACROSS_1, 1, 5)).toBe(0);
    expect(prevCellInEntry(ACROSS_1, 0, 5)).toBeUndefined();
    expect(nextCellInEntry(ACROSS_1, 99, 5)).toBeUndefined();
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

describe("nextEmptyCell skips filled cells, then moves on to the next open pista (T-WEB-S607)", () => {
  const across = (number: number, row: number): CrosswordClue => ({
    number,
    direction: "across",
    row,
    col: 0,
    length: 3,
    clue: `horizontal ${String(number)}`,
  });
  const ACROSS_3 = across(3, 2);
  const ACROSS_4 = across(4, 4);
  const DOWN_2_LONG: CrosswordClue = { ...DOWN_2, length: 3 };
  const SKIP_CLUES = [ACROSS_1, ACROSS_4, ACROSS_3, DOWN_2_LONG];

  function filled(...cells: readonly number[]): readonly (string | null)[] {
    return Array.from({ length: 25 }, (_unused, index) =>
      cells.includes(index) ? "x" : null,
    );
  }

  it("steps over a filled cell of the same entry", () => {
    expect(nextEmptyCell(SKIP_CLUES, filled(0, 1), 0, "across", 5)).toBe(2);
  });

  it("goes back to an earlier empty cell of the entry before leaving it", () => {
    expect(nextEmptyCell(SKIP_CLUES, filled(1, 2), 1, "across", 5)).toBe(0);
  });

  it("jumps to the first empty cell of the next pista by number, not by list order", () => {
    expect(nextEmptyCell(SKIP_CLUES, filled(0, 1, 2, 10), 2, "across", 5)).toBe(
      11,
    );
  });

  it("wraps from the last pista to the first open one", () => {
    expect(
      nextEmptyCell(
        SKIP_CLUES,
        filled(0, 2, 10, 11, 12, 20, 21, 22),
        22,
        "across",
        5,
      ),
    ).toBe(1);
  });

  it("follows the direction it was given", () => {
    expect(nextEmptyCell(SKIP_CLUES, filled(2, 7), 2, "down", 5)).toBe(12);
  });

  it("stays put when nothing is left to fill, or the cell has no entry that way", () => {
    expect(
      nextEmptyCell(
        SKIP_CLUES,
        filled(0, 1, 2, 10, 11, 12, 20, 21, 22),
        2,
        "across",
        5,
      ),
    ).toBeUndefined();
    expect(nextEmptyCell(SKIP_CLUES, filled(), 0, "down", 5)).toBeUndefined();
  });
});

describe("a 7x7 grid indexes, walks and finds entries by its own side (T-WEB-S670)", () => {
  const { clues } = SEVEN_DAILY;
  const [across1, down1, down2, across3] = clues as [
    CrosswordClue,
    CrosswordClue,
    CrosswordClue,
    CrosswordClue,
  ];
  const solution = flattenGrid(SEVEN_DAILY.grid);

  it("lists a down entry's cells a whole row of 7 apart, to row 6", () => {
    expect(entryCells(across1, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(entryCells(down2, 7)).toEqual([6, 13, 20, 27, 34, 41, 48]);
    expect(entryCells(across3, 7)).toEqual([42, 43, 44, 45, 46, 47, 48]);
  });

  it("finds the entry through a cell in column 6 and row 6, and falls back across or down", () => {
    expect(entryAt(clues, 48, "down", 7)).toBe(down2);
    expect(entryAt(clues, 48, "across", 7)).toBe(across3);
    expect(entryAt(clues, 13, "across", 7)).toBeUndefined();
    expect(activeEntry(clues, 13, "across", 7)).toBe(down2);
    expect(activeEntry(clues, 0, "down", 7)).toBe(down1);
  });

  it("steps inside an entry and past a filled cell using the 7-wide index", () => {
    expect(nextCellInEntry(down2, 6, 7)).toBe(13);
    expect(prevCellInEntry(down2, 48, 7)).toBe(41);

    const entries = solution.map((cell, index) =>
      index === 6 || index === 13 ? cell : null,
    );
    expect(nextEmptyCell(clues, entries, 6, "down", 7)).toBe(20);
  });
});
