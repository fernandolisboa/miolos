import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { CLASSIC_LAYOUT, geometryOf } from "../../src/sudoku/board";
import { DIAGONAL_LAYOUT } from "../../src/sudoku/generate";
import { gradeInternal } from "../../src/sudoku/grade";
import {
  SudokuGenerationError,
  generateDailySudoku,
  generateSudokuVariant,
  sudokuCriteriaForWeekday,
  type SudokuGrid,
  type SudokuLayout,
  type SudokuVariant,
  type Weekday,
} from "../../src/sudoku/index";
import { countSolutionsInternal } from "../../src/sudoku/solve";
import { FC_SEED, seedArb, weekdayArb } from "../daily-arbitraries";
import { propertyRuns } from "../property-runs";
import { PINNED_VARIANT_SEED, PINNED_VARIANTS } from "./variant-fixtures";

const PINNED_WEEKDAY: Weekday = 4;

const PROPERTY_TIMEOUT = { diagonal: 130_000, irregular: 165_000 };

function unitsOf(layout: SudokuLayout): number[][] {
  const lines = Array.from({ length: 9 }, (_, k) => [
    Array.from({ length: 9 }, (_, j) => k * 9 + j),
    Array.from({ length: 9 }, (_, j) => j * 9 + k),
    layout.regions.flatMap((id, i) => (id === k ? [i] : [])),
  ]).flat();
  return [...lines, ...layout.extraUnits.map((unit) => [...unit])];
}

function solvesLayout(grid: SudokuGrid, layout: SudokuLayout): boolean {
  return unitsOf(layout).every(
    (unit) =>
      unit.length === 9 &&
      unit
        .map((i) => grid[i]!)
        .sort((a, b) => a - b)
        .join("") === "123456789",
  );
}

describe.each<SudokuVariant>(["diagonal", "irregular"])(
  "generateSudokuVariant — %s",
  (variant) => {
    it(
      "is deterministic, unique, ladder-solvable and on the weekday ramp",
      () => {
        fc.assert(
          fc.property(seedArb, weekdayArb, (seed, weekday) => {
            const puzzle = generateSudokuVariant({ seed, weekday, variant });
            expect(generateSudokuVariant({ seed, weekday, variant })).toEqual(
              puzzle,
            );
            const { givens, solution, layout } = puzzle;
            expect(givens.every((v, i) => v === 0 || v === solution[i])).toBe(
              true,
            );
            expect(solvesLayout(solution, layout)).toBe(true);
            const geometry = geometryOf(layout);
            expect(countSolutionsInternal(givens, 2, geometry)).toBe(1);
            const criteria = sudokuCriteriaForWeekday(weekday);
            const graded = gradeInternal(givens, geometry);
            expect(graded.grade).toBe(criteria.tier);
            expect(graded.solved).toEqual(solution);
            expect(puzzle.tier).toBe(criteria.tier);
            const clues = givens.filter((v) => v !== 0).length;
            expect(puzzle.clueCount).toBe(clues);
            expect(clues).toBeGreaterThanOrEqual(criteria.minClues);
            expect(clues).toBeLessThanOrEqual(criteria.maxClues);
          }),
          { seed: FC_SEED, numRuns: propertyRuns(100) },
        );
      },
      PROPERTY_TIMEOUT[variant as "diagonal" | "irregular"],
    );

    it("matches its pinned literal for a fixed seed", () => {
      const pinned = PINNED_VARIANTS[variant as "diagonal" | "irregular"];
      const puzzle = generateSudokuVariant({
        seed: PINNED_VARIANT_SEED,
        weekday: PINNED_WEEKDAY,
        variant,
      });
      expect(puzzle.givens).toEqual(pinned.givens);
      expect(puzzle.solution).toEqual(pinned.solution);
      expect(puzzle.layout.regions).toEqual(pinned.regions);
      expect(puzzle.tier).toBe(3);
      expect(puzzle.clueCount).toBe(26);
      expect(puzzle.seed).toBe(PINNED_VARIANT_SEED);
      expect(Object.isFrozen(puzzle)).toBe(true);
    });
  },
);

describe("generateSudokuVariant", () => {
  it("adds the two diagonals only to the Diagonal layout", () => {
    const diagonal = generateSudokuVariant({
      seed: 3,
      weekday: 1,
      variant: "diagonal",
    });
    expect(diagonal.layout).toBe(DIAGONAL_LAYOUT);
    const irregular = generateSudokuVariant({
      seed: 3,
      weekday: 1,
      variant: "irregular",
    });
    expect(irregular.layout.extraUnits).toEqual([]);
    expect(irregular.layout.regions).not.toEqual(CLASSIC_LAYOUT.regions);
  });

  it("gives the classic daily plus the classic layout for classic", () => {
    for (const weekday of [1, 7] as const) {
      expect(
        generateSudokuVariant({ seed: 9, weekday, variant: "classic" }),
      ).toEqual({
        ...generateDailySudoku({ seed: 9, weekday }),
        layout: CLASSIC_LAYOUT,
      });
    }
  }, 15_000);

  it("rejects an unknown variant and a bad attempt cap", () => {
    expect(() =>
      generateSudokuVariant({
        seed: 1,
        weekday: 1,
        variant: "samurai" as SudokuVariant,
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudokuVariant({
        seed: 1,
        weekday: 1,
        variant: "diagonal",
        maxAttempts: 0,
      }),
    ).toThrow(RangeError);
  });

  it("gives up with the generation error once the attempts run out", () => {
    expect(() =>
      generateSudokuVariant({
        seed: 0,
        weekday: 7,
        variant: "irregular",
        maxAttempts: 1,
      }),
    ).toThrow(SudokuGenerationError);
  });
});
