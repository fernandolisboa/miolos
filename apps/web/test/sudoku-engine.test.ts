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

// T-WEB-S8 (plan 018 §15). `engine.ts` is the ONE boundary where the
// engine's `0`-is-empty grid and the client's `null`-is-empty cells meet
// (S6), plus the board's gutter-track placement (§12.3). Everything here is
// pure — no React, no DOM, no clock.

// Weekday 1 is tier 1, the cheapest rung of SUDOKU_WEEKDAY_CRITERIA
// (~0.7 ms per generation, plan 018 §19.6): a fixture, not a benchmark.
const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const EMPTY_ENTRIES: readonly SudokuCellValue[] = Array.from(
  { length: 81 },
  () => null,
);

/** The first index the player is free to write in. */
function firstPlayable(): number {
  return PUZZLE.givens.findIndex((cell) => cell === 0);
}

/**
 * The fixture's solution as digits. Narrowed by a throw rather than by a
 * cast — CLAUDE.md bans `as` in tests, and a tier-1 daily is solvable by
 * construction, so the throw is unreachable and says so.
 */
function solutionOf(): readonly SudokuDigit[] {
  const digits = solutionDigits(PUZZLE.givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

/** entries with `digit` written at `index`, everything else empty. */
function entriesWith(
  index: number,
  digit: SudokuCellValue,
): readonly SudokuCellValue[] {
  return EMPTY_ENTRIES.map((cell, at) => (at === index ? digit : cell));
}

describe("track", () => {
  it("maps the nine board columns onto eleven grid tracks, skipping the gutters", () => {
    // §12.3: the board is one flat CSS grid with two explicit 2px gutter
    // tracks, so placement is explicit — auto-placement would drop cells
    // into the gutters.
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
    // Every `@miolos/games/sudoku` entry point calls `assertSudokuGrid` and
    // throws a TypeError on anything that is not 81 integers 0–9 (landmine
    // 8). This function is that guarantee.
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
    // Two 1s in the first row: the solver's mask build rejects it outright.
    // The branch is unreachable for a published daily and defined anyway —
    // omitting exactly this branch was plan 017's finding `issue-ac-10`.
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
    // Without this the offline queue would have no body to POST (§8.2).
    expect(solvedDigits(mergedGrid(PUZZLE.givens, EMPTY_ENTRIES))).toBeNull();
    expect(
      solvedDigits(mergedGrid(PUZZLE.givens, entriesWith(0, 5))),
    ).toBeNull();
  });
});
