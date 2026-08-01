import {
  generateDailySudoku,
  solveSudoku,
  type SudokuPuzzle,
  type Weekday,
} from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { nextHint } from "../src/play/grid-hint";
import { playableGivens, solutionDigits } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";

// T-WEB-S9 (sudoku half) and T-WEB-S10 (plan 018 §15). `nextHint` is pure
// and deterministic, so it is proved directly rather than through the
// button — and through the SAME adapter the reducer uses (`playableGivens`
// / `solutionDigits`), because the hint's correctness is as much the
// adapter's as the algorithm's.
//
// Table-driven, deliberately: ADR-0017 scopes fast-check to packages/games
// and this ticket adds no test dependency (§3).

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Pinned seeds, in-file so a failure is reproducible from the source alone.
 * Arbitrary values, never a clock or a random draw.
 *
 * The COUNTS are a decision, not a default (plan 018 T-WEB-S10). Measured
 * on the plan's machine, twenty seeds cost 17/22/17/106/93/208/3425 ms for
 * weekdays 1–7 — Sunday is tier 5, two orders of magnitude dearer than
 * Monday — and CI runners are ~3–4× slower (commit `271a935`). Five seeds
 * for weekdays 1–5 and three for the two heavy ones is ≈0.6 s here and
 * ≈2.4 s on CI, against the 120 s ceiling each `it` carries below.
 */
const SEEDS: Readonly<Record<Weekday, readonly number[]>> = {
  1: [1, 42, 1_009, 20_260_801, 4_294_967_295],
  2: [2, 101, 4_242, 20_260_802, 4_294_967_294],
  3: [3, 512, 9_001, 20_260_803, 4_294_967_293],
  4: [7, 313, 7_777, 20_260_804, 4_294_967_292],
  5: [11, 271, 5_150, 20_260_805, 4_294_967_291],
  6: [13, 20_260_806, 4_294_967_290],
  7: [17, 20_260_807, 4_294_967_289],
};

/**
 * One seed per weekday — each list's FIRST — for the properties that need
 * shape rather than volume. Sharing the seeds with the table above is what
 * makes the memo below pay for the Sunday generation once instead of five
 * times.
 */
const SAMPLE: Readonly<Record<Weekday, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 7,
  5: 11,
  6: 13,
  7: 17,
};

/** The generation budget every `it` in this file runs against (§15). */
const HEAVY = 120_000;

const PUZZLES = new Map<string, SudokuPuzzle>();

/**
 * `generateDailySudoku`, memoized across this file's tests. Generation is
 * deterministic in (seed, weekday), so a cached puzzle is the same value —
 * and Sunday's tier-5 generation costs ~170 ms per seed here and ~4× that
 * on CI (§19.6), which is worth paying once rather than per assertion.
 *
 * It stays INSIDE the tests rather than becoming module-level state built at
 * import time: a `vitest` timeout covers what runs in an `it`, not what runs
 * during collection.
 */
function puzzleFor(weekday: Weekday, seed: number): SudokuPuzzle {
  const key = `${String(weekday)}:${String(seed)}`;
  const cached = PUZZLES.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const puzzle = generateDailySudoku({ seed, weekday });
  PUZZLES.set(key, puzzle);
  return puzzle;
}

/** 81 empty cells. */
const EMPTY: readonly (SudokuDigit | null)[] = Array.from(
  { length: 81 },
  () => null,
);

/**
 * The puzzle's solution, through the client's own adapter. Narrowed by a
 * throw rather than a cast (CLAUDE.md bans `as` in tests): a generated
 * daily is uniquely solvable by construction, so the throw is unreachable.
 */
function solutionOf(puzzle: SudokuPuzzle): readonly SudokuDigit[] {
  const digits = solutionDigits(puzzle.givens);
  if (digits === null) {
    throw new Error("a generated daily is uniquely solvable by construction");
  }
  return digits;
}

/** `solution[index]`, narrowed by a throw rather than by a cast. */
function digitAt(solution: readonly SudokuDigit[], index: number): SudokuDigit {
  const digit = solution[index];
  if (digit === undefined) {
    throw new Error(`the solution has no digit at index ${String(index)}`);
  }
  return digit;
}

/** Any digit that is not `digit` — the wrong entry a correction fixes. */
function otherThan(digit: SudokuDigit): SudokuDigit {
  return digit === 9 ? 1 : 9;
}

/** Row-major index of the first cell the player is free to fill. */
function firstFreeIndex(puzzle: SudokuPuzzle): number {
  return puzzle.givens.findIndex((cell) => cell === 0);
}

/** Row-major index of the last cell the player is free to fill. */
function lastFreeIndex(puzzle: SudokuPuzzle): number {
  return puzzle.givens.reduce(
    (last, cell, index) => (cell === 0 ? index : last),
    -1,
  );
}

describe("nextHint over a sudoku daily", () => {
  it(
    "fills the first empty non-given cell in row-major order, for every weekday",
    () => {
      for (const weekday of WEEKDAYS) {
        const puzzle = puzzleFor(weekday, SAMPLE[weekday]);
        const first = firstFreeIndex(puzzle);
        const hint = nextHint(
          solutionOf(puzzle),
          playableGivens(puzzle.givens),
          EMPTY,
        );

        expect(hint).toEqual({
          index: first,
          value: puzzle.solution[first],
          kind: "fill",
        });
      }
    },
    HEAVY,
  );

  it(
    "prefers correcting a contradicting entry over filling an empty cell",
    () => {
      for (const weekday of WEEKDAYS) {
        const puzzle = puzzleFor(weekday, SAMPLE[weekday]);
        const solution = solutionOf(puzzle);
        const wrongAt = lastFreeIndex(puzzle);
        expect(wrongAt).toBeGreaterThan(firstFreeIndex(puzzle));

        const correct = digitAt(solution, wrongAt);
        const entries = EMPTY.map((cell, index) =>
          index === wrongAt ? otherThan(correct) : cell,
        );
        const hint = nextHint(solution, playableGivens(puzzle.givens), entries);

        // The LAST mistake still outranks the FIRST empty cell: a
        // contradiction unblocks the player where a fill does not.
        expect(hint).toEqual({
          index: wrongAt,
          value: correct,
          kind: "correction",
        });
      }
    },
    HEAVY,
  );

  it(
    "returns null on a complete, correct grid",
    () => {
      for (const weekday of WEEKDAYS) {
        const puzzle = puzzleFor(weekday, SAMPLE[weekday]);
        const solution = solutionOf(puzzle);
        const entries = solution.map((digit, index) =>
          puzzle.givens[index] === 0 ? digit : null,
        );

        expect(
          nextHint(solution, playableGivens(puzzle.givens), entries),
        ).toBeNull();
      }
    },
    HEAVY,
  );

  it(
    "is deterministic: the same state yields the same hint",
    () => {
      const puzzle = puzzleFor(4, 20_260_801);
      const solution = solutionOf(puzzle);
      const givens = playableGivens(puzzle.givens);

      expect(nextHint(solution, givens, EMPTY)).toEqual(
        nextHint(solution, givens, EMPTY),
      );
    },
    HEAVY,
  );

  it(
    "always reveals solveSudoku's own digit at that index",
    () => {
      // T-WEB-S10, over the whole pinned table. This is what ties the client's
      // hint to the engine's solver: the adapter (`solutionDigits`) may not
      // reorder, truncate or re-index it, and the hint may never touch a given.
      for (const weekday of WEEKDAYS) {
        for (const seed of SEEDS[weekday]) {
          const puzzle = puzzleFor(weekday, seed);
          const solved = solveSudoku(puzzle.givens);
          if (solved === null) {
            throw new Error(`unsolvable daily for seed ${String(seed)}`);
          }
          const solution = solutionOf(puzzle);
          const givens = playableGivens(puzzle.givens);

          expect(solution).toEqual(solved);

          // Empty board, one wrong entry, and a half-filled board: three
          // states, one property.
          const wrongAt = lastFreeIndex(puzzle);
          const wrong = EMPTY.map((cell, index) =>
            index === wrongAt ? otherThan(digitAt(solution, wrongAt)) : cell,
          );
          const half = solution.map((digit, index) =>
            puzzle.givens[index] === 0 && index % 2 === 0 ? digit : null,
          );

          for (const entries of [EMPTY, wrong, half]) {
            const hint = nextHint(solution, givens, entries);
            if (hint === null) {
              throw new Error(
                `no hint for seed ${String(seed)} on weekday ${String(weekday)}`,
              );
            }
            // Against the ENGINE's own solution, not the adapter's copy of it.
            expect(hint.value).toBe(solved[hint.index]);
            expect(puzzle.givens[hint.index]).toBe(0);
          }
        }
      }
    },
    HEAVY,
  );
});
