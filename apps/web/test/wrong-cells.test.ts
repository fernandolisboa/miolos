import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { hintGivens } from "../src/crossword/grid";
import type { CrosswordCellValue } from "../src/crossword/state";
import { solutionMarks } from "../src/nonogram/engine";
import { nextBinaryHint, nextHint, wrongCells } from "../src/play/grid-hint";
import { playableGivens } from "../src/sudoku/engine";
import { correctPartial, onEveryWeekday } from "./hint-boards";

const SEEDS = [3, 29, 404, 20_260_913] as const;

function corrupt<T>(
  entries: readonly (T | null)[],
  wrongValue: (index: number) => T,
  seed: number,
): readonly (T | null)[] {
  let state = seed;
  return entries.map((entry, index) => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return state % 5 === 0 ? wrongValue(index) : entry;
  });
}

function expectLowestIsTheCorrection<T>(
  solution: readonly T[],
  givens: readonly (T | null)[],
  entries: readonly (T | null)[],
  binary: boolean,
): void {
  const wrong = wrongCells(solution, givens, entries);
  const hint = binary
    ? nextBinaryHint(
        solution as unknown as readonly (0 | 1)[],
        entries as unknown as readonly (0 | 1 | null)[],
      )
    : nextHint(solution, givens, entries);
  if (hint?.kind === "correction") {
    expect(Math.min(...wrong)).toBe(hint.index);
  } else {
    expect(wrong.size).toBe(0);
  }
}

describe("wrongCells marks the entries the solution contradicts (T-WEB-S582)", () => {
  const solution = ["a", "b", "c", "d", null, "f"];
  const noGivens = [null, null, null, null, null, null];

  it("flags an entry that differs from the solution and nothing else", () => {
    expect([
      ...wrongCells(solution, noGivens, ["a", "x", null, "d", null, "f"]),
    ]).toEqual([1]);
    expect(
      wrongCells(solution, noGivens, [null, null, null, null, null, null]),
    ).toEqual(new Set());
  });

  it("never flags a given, even when the stored entry contradicts it", () => {
    const givens = ["a", null, null, null, null, null];
    expect(
      wrongCells(solution, givens, ["z", null, null, null, null, null]),
    ).toEqual(new Set());
  });

  it("never flags a block, a cell with no solution value", () => {
    expect(
      wrongCells(solution, noGivens, [null, null, null, null, "x", null]),
    ).toEqual(new Set());
    expect(
      wrongCells(solution, hintGivens(solution), [
        null,
        null,
        null,
        null,
        "x",
        null,
      ]),
    ).toEqual(new Set());
  });

  it("takes no givens for the binary games and flags both a fill on empty and a cross on filled", () => {
    const binary = [1, 0, 1, 0] as const;
    expect([...wrongCells(binary, null, [0, 1, 1, null])]).toEqual([0, 1]);
  });

  it("agrees with the hint's correction on generated Sudoku boards", () => {
    for (const [at, puzzle] of onEveryWeekday(1, (seed, weekday) =>
      generateDailySudoku({ seed, weekday }),
    ).entries()) {
      const solution = puzzle.solution.map((digit) => digit);
      const givens = playableGivens(puzzle.givens);
      const entries = corrupt(
        correctPartial(solution, at + 1).map((digit, index) =>
          givens[index] === null ? digit : null,
        ),
        (index) => (solution[index] === 1 ? 2 : 1),
        at + 7,
      ).map((digit, index) => (givens[index] === null ? digit : null));
      expectLowestIsTheCorrection(solution, givens, entries, false);
    }
  });

  it("agrees with the hint's correction on generated Binairo boards", () => {
    for (const [at, puzzle] of onEveryWeekday(3, (seed, weekday) =>
      generateBinairo({ seed, weekday }),
    ).entries()) {
      const entries = corrupt<0 | 1>(
        correctPartial(puzzle.solution, at + 1).map((mark, index) =>
          puzzle.givens[index] === null ? mark : null,
        ),
        (index) => (puzzle.solution[index] === 1 ? 0 : 1),
        at + 7,
      ).map((mark, index) => (puzzle.givens[index] === null ? mark : null));
      expectLowestIsTheCorrection(
        puzzle.solution,
        puzzle.givens,
        entries,
        false,
      );
    }
  });

  it("agrees with the hint's correction on generated Rainhas and Nonogram boards", () => {
    for (const [at, puzzle] of onEveryWeekday(3, (seed, weekday) =>
      generateQueens({ seed, weekday }),
    ).entries()) {
      const entries = corrupt<0 | 1>(
        correctPartial(puzzle.solution, at + 1),
        (index) => (puzzle.solution[index] === 1 ? 0 : 1),
        at + 7,
      );
      const noGivens = puzzle.solution.map(() => null);
      expectLowestIsTheCorrection(puzzle.solution, noGivens, entries, true);
    }
    for (const seed of SEEDS) {
      const puzzle = generateNonogram(seed, 3);
      const marks = solutionMarks(puzzle.clues);
      expect(marks).not.toBeNull();
      const solution = marks ?? [];
      const entries = corrupt<0 | 1>(
        correctPartial(solution, seed),
        (index) => (solution[index] === 1 ? 0 : 1),
        seed + 7,
      );
      const noGivens = solution.map(() => null);
      expectLowestIsTheCorrection(solution, noGivens, entries, true);
    }
  });

  it("agrees with the hint's correction on a Cruzadinha grid with blocks", () => {
    const grid: readonly CrosswordCellValue[] = [
      "c",
      "a",
      "t",
      null,
      "o",
      null,
    ];
    const entries: readonly CrosswordCellValue[] = [
      null,
      "x",
      "t",
      null,
      null,
      null,
    ];
    expectLowestIsTheCorrection(grid, hintGivens(grid), entries, false);
    expect([...wrongCells(grid, null, entries)]).toEqual([1]);
  });
});
