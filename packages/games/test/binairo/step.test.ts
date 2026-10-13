import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  generateBinairo,
  nextBinairoStep,
  type BinairoGrid,
  type BinairoLine,
  type BinairoStep,
} from "../../src/binairo/index";
import { place, propagate, stateFromGrid } from "../../src/binairo/techniques";
import { WEEKDAYS } from "../../src/index";
import { propertyRuns } from "../property-runs";
import { grid } from "./fixtures";

const FC_SEED = 297_297;
const N = 8;
const HALF = N / 2;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);
const maskArb = fc.array(fc.boolean(), { minLength: N * N, maxLength: N * N });

function lineCells({ kind, index }: BinairoLine): number[] {
  return Array.from({ length: N }, (_, i) =>
    kind === "row" ? index * N + i : i * N + index,
  );
}

function row(index: number): number[] {
  return lineCells({ kind: "row", index });
}

function column(index: number): number[] {
  return lineCells({ kind: "column", index });
}

function forcedByLookahead(board: BinairoGrid, index: number, value: 0 | 1) {
  const state = stateFromGrid(board);
  if (state === null) {
    throw new Error("the board is inconsistent");
  }
  return !place(state, index, value === 0 ? 1 : 0) || !propagate(state, 1);
}

function expectHonest(board: BinairoGrid, step: BinairoStep): void {
  const opposite = step.value === 0 ? 1 : 0;
  expect(board[step.index]).toBeNull();
  expect(step.twin === null).toBe(step.rule !== "duplicate");
  if (step.rule === "lookahead") {
    expect(step.line).toBeNull();
    expect(step.cells).toEqual([]);
    expect(forcedByLookahead(board, step.index, step.value)).toBe(true);
    return;
  }
  expect(step.line).not.toBeNull();
  const line = lineCells(step.line!);
  const at = line.indexOf(step.index);
  expect(at).not.toBe(-1);
  if (step.rule === "pair" || step.rule === "gap") {
    const [first, second] = step.cells.map((cell) => line.indexOf(cell));
    expect(first).not.toBe(-1);
    expect(step.cells.map((cell) => board[cell])).toEqual([opposite, opposite]);
    if (step.rule === "gap") {
      expect([second, at]).toEqual([first! + 2, first! + 1]);
    } else {
      expect(second).toBe(first! + 1);
      expect([first! - 1, second! + 1]).toContain(at);
    }
  } else if (step.rule === "count") {
    expect(step.cells).toEqual(line);
    expect(line.filter((cell) => board[cell] === opposite)).toHaveLength(HALF);
  } else {
    const twin = lineCells({ kind: step.line!.kind, index: step.twin! });
    expect(step.twin).not.toBe(step.line!.index);
    expect(step.cells).toEqual(twin);
    expect(twin.every((cell) => board[cell] !== null)).toBe(true);
    expect(line.filter((cell) => board[cell] === null)).toHaveLength(2);
    line.forEach((cell, k) => {
      expect([null, board[twin[k]!]]).toContain(board[cell]);
    });
    expect(board[twin[at]!]).toBe(opposite);
  }
}

describe("nextBinairoStep", () => {
  it.each([
    {
      rule: "pair",
      board:
        "........ ........ ...11... ........ ........ ........ ........ ........",
      step: {
        index: 18,
        value: 0,
        line: { kind: "row", index: 2 },
        cells: [19, 20],
      },
    },
    {
      rule: "pair",
      board:
        ".....0.. .....0.. ........ ........ ........ ........ ........ ........",
      step: {
        index: 21,
        value: 1,
        line: { kind: "column", index: 5 },
        cells: [5, 13],
      },
    },
    {
      rule: "gap",
      board:
        "........ ........ ........ ........ ........ ........ 1.1..... ........",
      step: {
        index: 49,
        value: 0,
        line: { kind: "row", index: 6 },
        cells: [48, 50],
      },
    },
    {
      rule: "gap",
      board:
        ".......0 ........ .......0 ........ ........ ........ ........ ........",
      step: {
        index: 15,
        value: 1,
        line: { kind: "column", index: 7 },
        cells: [7, 23],
      },
    },
    {
      rule: "count",
      board:
        "........ 010010.. ........ ........ ........ ........ ........ ........",
      step: {
        index: 14,
        value: 1,
        line: { kind: "row", index: 1 },
        cells: row(1),
      },
    },
    {
      rule: "count",
      board:
        "...0.... ...1.... ...0.... ...0.... ...1.... ...0.... ........ ........",
      step: {
        index: 51,
        value: 1,
        line: { kind: "column", index: 3 },
        cells: column(3),
      },
    },
    {
      rule: "duplicate",
      board:
        "00110011 ........ ........ ........ .011001. ........ ........ ........",
      step: {
        index: 32,
        value: 1,
        line: { kind: "row", index: 4 },
        twin: 0,
        cells: row(0),
      },
    },
    {
      rule: "duplicate",
      board:
        "0....... 0...0... 1...1... 1...1... 0...0... 0...0... 1...1... 1.......",
      step: {
        index: 4,
        value: 1,
        line: { kind: "column", index: 4 },
        twin: 0,
        cells: column(0),
      },
    },
    {
      rule: "lookahead",
      board:
        ".0110..0 .011001. 11001.0. ......1. ....0..0 .101..0. .....0.. 10......",
      step: { index: 8, value: 0, line: null, cells: [] },
    },
  ])("names a $rule at cell $step.index", ({ rule, board, step }) => {
    const found = nextBinairoStep(grid(board));

    expect(found).toEqual({ twin: null, ...step, rule });
    expectHonest(grid(board), found!);
  });

  it("names a duplicate line before a lookahead that also applies", () => {
    const board = grid(
      "10010110 10010011 01101001 00110110 11001001 0..010.1 1..101.0 01101100",
    );

    expect(nextBinairoStep(board)).toEqual({
      index: 46,
      value: 1,
      rule: "duplicate",
      line: { kind: "column", index: 6 },
      twin: 3,
      cells: column(3),
    });
    expect(forcedByLookahead(board, 41, 0)).toBe(true);
  });

  it("returns null on a full grid, an inconsistent board and an empty board", () => {
    expect(
      nextBinairoStep(
        grid(
          "00101101 11001001 00110110 11010100 00101011 10110010 01010101 11001010",
        ),
      ),
    ).toBeNull();
    expect(
      nextBinairoStep(grid("111....." + " ........".repeat(7))),
    ).toBeNull();
    expect(nextBinairoStep(new Array<null>(N * N).fill(null))).toBeNull();
  });

  it("gives the same step for the same board and leaves the board alone", () => {
    const board = grid(
      ".0110..0 .011001. 11001.0. ......1. ....0..0 .101..0. .....0.. 10......",
    );
    const before = [...board];

    expect(nextBinairoStep(board)).toEqual(nextBinairoStep(board));
    expect(board).toEqual(before);
  });

  it("rejects a grid that is not square", () => {
    expect(() => nextBinairoStep(new Array<null>(63).fill(null))).toThrow(
      RangeError,
    );
  });

  it("walks every daily to its solution by rules that really apply", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, maskArb, (seed, weekday, mask) => {
        const { givens, solution } = generateBinairo({ seed, weekday });
        const partial = givens.map((cell, i) =>
          mask[i] ? solution[i]! : cell,
        );
        for (const start of [givens, partial]) {
          const board = [...start];
          for (;;) {
            const step = nextBinairoStep(board);
            if (step === null) {
              break;
            }
            expect(step.value).toBe(solution[step.index]);
            expectHonest(board, step);
            board[step.index] = step.value;
          }
          expect(board).toEqual(solution);
        }
      }),
      { seed: FC_SEED, numRuns: propertyRuns(100) },
    );
  }, 10_000);
});
