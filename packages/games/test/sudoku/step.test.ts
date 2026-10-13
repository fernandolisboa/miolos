import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PEERS, UNITS } from "../../src/sudoku/board";
import {
  generateDailySudoku,
  nextSudokuStep,
  type SudokuGrid,
  type SudokuStep,
  type Weekday,
} from "../../src/sudoku/index";
import { propertyRuns } from "../property-runs";
import {
  EMPTY_GRID,
  FULL_GRID,
  TECHNIQUE_FIXTURES,
  TWO_SOLUTION_GRID,
} from "./fixtures";

const FC_SEED = 220_022;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);
const maskArb = fc.array(fc.boolean(), { minLength: 81, maxLength: 81 });

function givensOf(technique: string): SudokuGrid {
  const fixture = TECHNIQUE_FIXTURES.find((f) => f.technique === technique);
  if (fixture === undefined) {
    throw new Error(`no ${technique} fixture`);
  }
  return fixture.givens;
}

function firstStall(givens: SudokuGrid): SudokuGrid {
  const grid = [...givens];
  let step = nextSudokuStep(grid);
  while (step !== null && step.after === null) {
    grid[step.index] = step.digit;
    step = nextSudokuStep(grid);
  }
  return grid;
}

function candidates(grid: SudokuGrid, index: number): readonly number[] {
  if (grid[index] !== 0) {
    return [];
  }
  const seen = new Set(PEERS[index]!.map((peer) => grid[peer]));
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((digit) => !seen.has(digit));
}

function isNakedSingle(grid: SudokuGrid, index: number): boolean {
  return candidates(grid, index).length === 1;
}

function hiddenSinglesIn(grid: SudokuGrid, unit: readonly number[]): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((digit) => {
    const homes = unit.filter((i) => candidates(grid, i).includes(digit));
    return homes.length === 1 ? [digit] : [];
  });
}

function unitCells(unit: NonNullable<SudokuStep["unit"]>): readonly number[] {
  const offset = { row: 0, column: 9, box: 18 }[unit.kind];
  return UNITS[offset + unit.index]!;
}

function anyPlainSingle(grid: SudokuGrid): boolean {
  return (
    grid.some((_, i) => isNakedSingle(grid, i)) ||
    UNITS.some((unit) => hiddenSinglesIn(grid, unit).length > 0)
  );
}

function expectHonest(grid: SudokuGrid, step: SudokuStep): void {
  expect(grid[step.index]).toBe(0);
  if (step.after !== null) {
    expect(anyPlainSingle(grid)).toBe(false);
  } else if (step.technique === "nakedSingle") {
    expect(candidates(grid, step.index)).toEqual([step.digit]);
    expect(grid.findIndex((_, i) => isNakedSingle(grid, i))).toBe(step.index);
  } else {
    expect(grid.some((_, i) => isNakedSingle(grid, i))).toBe(false);
    expect(step.unit).not.toBeNull();
    const unit = unitCells(step.unit!);
    expect(unit).toContain(step.index);
    expect(hiddenSinglesIn(grid, unit)).toContain(step.digit);
    expect(candidates(grid, step.index)).toContain(step.digit);
  }
  expect(step.cells).toEqual(
    step.unit === null ? PEERS[step.index] : unitCells(step.unit),
  );
}

describe("nextSudokuStep", () => {
  it("names the first naked single in reading order", () => {
    const grid = FULL_GRID.map((v, i) =>
      i === 0 || i === 13 || i === 26 ? 0 : v,
    );

    expect(nextSudokuStep(grid)).toEqual({
      index: 0,
      digit: 7,
      technique: "nakedSingle",
      unit: null,
      cells: PEERS[0],
      after: null,
    });
  });

  it("names a hidden single with its unit when no naked single exists", () => {
    const grid = givensOf("xWingCols");

    expect(nextSudokuStep(grid)).toEqual({
      index: 67,
      digit: 5,
      technique: "hiddenSingle",
      unit: { kind: "row", index: 7 },
      cells: UNITS[7],
      after: null,
    });
  });

  it.each([
    {
      fixture: "pointing",
      step: { index: 56, digit: 4, technique: "nakedSingle", unit: null },
      after: "pointing",
    },
    {
      fixture: "hiddenPair",
      step: {
        index: 24,
        digit: 7,
        technique: "hiddenSingle",
        unit: { kind: "column", index: 6 },
      },
      after: "hiddenPair",
    },
    {
      fixture: "xWingRows",
      step: { index: 11, digit: 6, technique: "nakedSingle", unit: null },
      after: "xWingRows",
    },
  ])(
    "names $after as the elimination that unlocks the $fixture fixture's stall",
    ({ fixture, step, after }) => {
      const grid = firstStall(givensOf(fixture));
      const found = nextSudokuStep(grid);

      expect(found).toMatchObject({ ...step, after });
      expect(anyPlainSingle(grid)).toBe(false);
    },
  );

  it("returns null on a full grid and on boards the ladder cannot move", () => {
    expect(nextSudokuStep(FULL_GRID)).toBeNull();
    expect(nextSudokuStep(TWO_SOLUTION_GRID)).toBeNull();
    expect(nextSudokuStep(EMPTY_GRID)).toBeNull();
  });

  it("gives the same step for the same board", () => {
    const grid = givensOf("hiddenPair");

    expect(nextSudokuStep(grid)).toEqual(nextSudokuStep(grid));
  });

  it("rejects malformed grids", () => {
    expect(() => nextSudokuStep(new Array<number>(80).fill(0))).toThrow(
      TypeError,
    );
  });

  it("places the solution's digit by a technique that really applies, on every tier", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, maskArb, (seed, weekday, mask) => {
        const puzzle = generateDailySudoku({ seed, weekday });
        const bare = nextSudokuStep(puzzle.givens);
        expect(bare).not.toBeNull();
        const partial = puzzle.givens.map((given, i) =>
          mask[i]! ? puzzle.solution[i]! : given,
        );
        for (const grid of [puzzle.givens, partial]) {
          const step = nextSudokuStep(grid);
          if (step !== null) {
            expect(step.digit).toBe(puzzle.solution[step.index]);
            expectHonest(grid, step);
          }
        }
      }),
      { seed: FC_SEED, numRuns: propertyRuns(100) },
    );
  }, 240_000);
});
