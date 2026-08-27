import {
  generateDailySudoku,
  getSudokuConflicts,
  isSudokuSolved,
  solveSudoku,
} from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import {
  isPlayable,
  mergedGrid,
  playableGivens,
  solutionDigits,
  solvedDigits,
  track,
} from "../src/sudoku/engine";
import type { SudokuCellValue, SudokuDigit } from "../src/sudoku/state";

const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const EMPTY_ENTRIES: readonly SudokuCellValue[] = Array.from(
  { length: 81 },
  () => null,
);

function firstPlayable(): number {
  return PUZZLE.givens.findIndex((cell) => cell === 0);
}

function solutionOf(): readonly SudokuDigit[] {
  const digits = solutionDigits(PUZZLE.givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

function entriesWith(
  index: number,
  digit: SudokuCellValue,
): readonly SudokuCellValue[] {
  return EMPTY_ENTRIES.map((cell, at) => (at === index ? digit : cell));
}

describe("track", () => {
  it("maps the nine board columns onto eleven grid tracks, skipping the gutters", () => {
    expect(Array.from({ length: 9 }, (_unused, index) => track(index))).toEqual(
      [1, 2, 3, 5, 6, 7, 9, 10, 11],
    );
  });
});

describe("isPlayable", () => {
  it("is true exactly where the givens are empty", () => {
    const playable = PUZZLE.givens.map((_cell, index) =>
      isPlayable(PUZZLE.givens, index),
    );

    expect(playable).toEqual(PUZZLE.givens.map((cell) => cell === 0));
    expect(playable.filter(Boolean)).toHaveLength(81 - PUZZLE.clueCount);
  });

  it("is false outside the board, so a stray index is a no-op and never a write", () => {
    expect(isPlayable(PUZZLE.givens, -1)).toBe(false);
    expect(isPlayable(PUZZLE.givens, 81)).toBe(false);
  });
});

describe("mergedGrid", () => {
  it("is the givens themselves when nothing has been entered", () => {
    expect(mergedGrid(PUZZLE.givens, EMPTY_ENTRIES)).toEqual([
      ...PUZZLE.givens,
    ]);
  });

  it("maps null to the engine's 0 sentinel and carries a written digit through", () => {
    const index = firstPlayable();
    const merged = mergedGrid(PUZZLE.givens, entriesWith(index, 7));

    expect(merged[index]).toBe(7);
    expect(merged.filter((cell) => cell === 0)).toHaveLength(
      81 - PUZZLE.clueCount - 1,
    );
  });

  it("never lets an entry overwrite a given", () => {
    const givenIndex = PUZZLE.givens.findIndex((cell) => cell !== 0);
    const merged = mergedGrid(PUZZLE.givens, entriesWith(givenIndex, 1));

    expect(merged[givenIndex]).toBe(PUZZLE.givens[givenIndex]);
  });

  it("always satisfies the engine's guard, so no entry point can throw", () => {
    const merged = mergedGrid(PUZZLE.givens, entriesWith(firstPlayable(), 9));

    expect(merged).toHaveLength(81);
    expect(() => getSudokuConflicts(merged)).not.toThrow();
    expect(() => isSudokuSolved(merged)).not.toThrow();
  });
});

describe("playableGivens", () => {
  it("maps 0 to null and keeps every clue, which is what countFilled needs", () => {
    const playable = playableGivens(PUZZLE.givens);

    expect(playable).toHaveLength(81);
    expect(playable.filter((cell) => cell !== null)).toHaveLength(
      PUZZLE.clueCount,
    );
    expect(playable).toEqual(
      PUZZLE.givens.map((cell) => (cell === 0 ? null : cell)),
    );
  });
});

describe("solutionDigits", () => {
  it("returns the engine's own solution, narrowed to 81 digits", () => {
    const solution = solutionDigits(PUZZLE.givens);

    expect(solution).toEqual([...PUZZLE.solution]);
    expect(solution).toEqual(solveSudoku(PUZZLE.givens));
    expect(solution?.every((digit) => digit >= 1 && digit <= 9)).toBe(true);
  });

  it("returns null for an unsolvable grid, which is the hint's defined fallback", () => {
    const contradictory = EMPTY_ENTRIES.map((_cell, index) =>
      index === 0 || index === 1 ? 1 : 0,
    );

    expect(solveSudoku(contradictory)).toBeNull();
    expect(solutionDigits(contradictory)).toBeNull();
  });
});

describe("solvedDigits", () => {
  it("returns 81 digits for a solved merged grid", () => {
    const solution = solutionOf();
    const merged = mergedGrid(
      PUZZLE.givens,
      solution.map((digit, index) =>
        PUZZLE.givens[index] === 0 ? digit : null,
      ),
    );

    expect(isSudokuSolved(merged)).toBe(true);
    expect(solvedDigits(merged)).toEqual([...PUZZLE.solution]);
  });

  it("returns null when any cell is still 0 — the guard buildRecord writes `grid` behind", () => {
    expect(solvedDigits(mergedGrid(PUZZLE.givens, EMPTY_ENTRIES))).toBeNull();
    expect(
      solvedDigits(mergedGrid(PUZZLE.givens, entriesWith(0, 5))),
    ).toBeNull();
  });
});
