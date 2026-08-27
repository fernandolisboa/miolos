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

//

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

const SEEDS: Readonly<Record<Weekday, readonly number[]>> = {
  1: [1, 42, 1_009, 20_260_801, 4_294_967_295],
  2: [2, 101, 4_242, 20_260_802, 4_294_967_294],
  3: [3, 512, 9_001, 20_260_803, 4_294_967_293],
  4: [7, 313, 7_777, 20_260_804, 4_294_967_292],
  5: [11, 271, 5_150, 20_260_805, 4_294_967_291],
  6: [13, 20_260_806, 4_294_967_290],
  7: [17, 20_260_807, 4_294_967_289],
};

const SAMPLE: Readonly<Record<Weekday, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 7,
  5: 11,
  6: 13,
  7: 17,
};

const HEAVY = 120_000;

const PUZZLES = new Map<string, SudokuPuzzle>();

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

const EMPTY: readonly (SudokuDigit | null)[] = Array.from(
  { length: 81 },
  () => null,
);

function solutionOf(puzzle: SudokuPuzzle): readonly SudokuDigit[] {
  const digits = solutionDigits(puzzle.givens);
  if (digits === null) {
    throw new Error("a generated daily is uniquely solvable by construction");
  }
  return digits;
}

function digitAt(solution: readonly SudokuDigit[], index: number): SudokuDigit {
  const digit = solution[index];
  if (digit === undefined) {
    throw new Error(`the solution has no digit at index ${String(index)}`);
  }
  return digit;
}

function otherThan(digit: SudokuDigit): SudokuDigit {
  return digit === 9 ? 1 : 9;
}

function firstFreeIndex(puzzle: SudokuPuzzle): number {
  return puzzle.givens.findIndex((cell) => cell === 0);
}

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

            expect(hint.value).toBe(solved[hint.index]);
            expect(puzzle.givens[hint.index]).toBe(0);
          }
        }
      }
    },
    HEAVY,
  );
});
