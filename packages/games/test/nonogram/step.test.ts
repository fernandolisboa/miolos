import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  deriveClues,
  generateNonogram,
  nextNonogramStep,
  type NonogramCellState,
  type NonogramClues,
  type NonogramStep,
} from "../../src/nonogram/index";
import { FC_SEED, seedArb, weekdayArb } from "../daily-arbitraries";

const densityArb = fc.integer({ min: 0, max: 100 });
const maskArb = fc.array(fc.integer({ min: 0, max: 99 }), {
  minLength: 225,
  maxLength: 225,
});

function cluesOf(rows: readonly string[]): NonogramClues {
  return deriveClues(rows.map((row) => [...row].map((ch) => ch === "#")));
}

function board(rows: readonly string[]): NonogramCellState[] {
  return rows.flatMap((row) =>
    [...row].map((ch) =>
      ch === "#" ? "filled" : ch === "x" ? "empty" : "unknown",
    ),
  );
}

function arrangements(length: number, runs: readonly number[]): boolean[][] {
  if (runs.length === 0) {
    return [new Array<boolean>(length).fill(false)];
  }
  const [first = 0, ...rest] = runs;
  const restMin = rest.reduce((sum, run) => sum + run + 1, 0);
  const found: boolean[][] = [];
  for (let start = 0; start + first + restMin <= length; start += 1) {
    const head = [
      ...new Array<boolean>(start).fill(false),
      ...new Array<boolean>(first).fill(true),
    ];
    if (rest.length === 0) {
      found.push([
        ...head,
        ...new Array<boolean>(length - head.length).fill(false),
      ]);
      continue;
    }
    for (const tail of arrangements(length - head.length - 1, rest)) {
      found.push([...head, false, ...tail]);
    }
  }
  return found;
}

type LineSpec = Omit<NonogramStep, "index" | "value">;

function linesOf(clues: NonogramClues): LineSpec[] {
  const n = clues.size;
  const span = Array.from({ length: n }, (_, k) => k);
  return [
    ...clues.rows.map((runs, r) => ({
      line: { kind: "row" as const, index: r },
      runs,
      cells: span.map((k) => r * n + k),
    })),
    ...clues.cols.map((runs, c) => ({
      line: { kind: "column" as const, index: c },
      runs,
      cells: span.map((k) => k * n + c),
    })),
  ];
}

function consistent(
  spec: LineSpec,
  states: readonly NonogramCellState[],
): boolean[][] {
  return arrangements(spec.cells.length, spec.runs).filter((arrangement) =>
    spec.cells.every((cell, k) => {
      const state = states[cell];
      return state === "unknown" || (state === "filled") === arrangement[k];
    }),
  );
}

function bruteForceStep(
  clues: NonogramClues,
  states: readonly NonogramCellState[],
): NonogramStep | null {
  let cross: NonogramStep | null = null;
  for (const spec of linesOf(clues)) {
    const options = consistent(spec, states);
    if (options.length === 0) {
      return null;
    }
    for (let k = 0; k < spec.cells.length; k += 1) {
      const index = spec.cells[k]!;
      if (states[index] !== "unknown") {
        continue;
      }
      if (options.every((option) => option[k] === true)) {
        return { index, value: 1, ...spec };
      }
      if (cross === null && options.every((option) => option[k] === false)) {
        cross = { index, value: 0, ...spec };
      }
    }
  }
  return cross;
}

describe("nextNonogramStep", () => {
  it("names the first cell a row's números fix as filled", () => {
    const picture = [".###.", "#####", "..#..", "..#..", "....."];

    expect(
      nextNonogramStep(cluesOf(picture), board(picture.map(() => "?????"))),
    ).toEqual({
      index: 2,
      value: 1,
      line: { kind: "row", index: 0 },
      runs: [3],
      cells: [0, 1, 2, 3, 4],
    });
  });

  it("names a cross when no line fixes a filled cell", () => {
    const picture = [".#.", "...", "..."];

    expect(
      nextNonogramStep(cluesOf(picture), board(["?#?", "???", "???"])),
    ).toEqual({
      index: 0,
      value: 0,
      line: { kind: "row", index: 0 },
      runs: [1],
      cells: [0, 1, 2],
    });
  });

  it("names a column when no row fixes anything", () => {
    const picture = ["#..", "#..", "#.."];

    expect(
      nextNonogramStep(cluesOf(picture), board(["???", "???", "???"])),
    ).toEqual({
      index: 0,
      value: 1,
      line: { kind: "column", index: 0 },
      runs: [3],
      cells: [0, 3, 6],
    });
  });

  it("prefers a later line's filled cell over an earlier line's cross", () => {
    const picture = ["...", "#..", "#.."];

    expect(
      nextNonogramStep(cluesOf(picture), board(["???", "???", "???"])),
    ).toEqual({
      index: 3,
      value: 1,
      line: { kind: "column", index: 0 },
      runs: [2],
      cells: [0, 3, 6],
    });
  });

  it("returns null on a complete board, a contradiction, and a stuck board", () => {
    const picture = [".#.", "###", ".#."];

    expect(
      nextNonogramStep(cluesOf(picture), board(["x#x", "###", "x#x"])),
    ).toBeNull();
    expect(
      nextNonogramStep(cluesOf(picture), board(["##?", "???", "???"])),
    ).toBeNull();
    expect(
      nextNonogramStep(cluesOf(["#.", ".#"]), board(["??", "??"])),
    ).toBeNull();
  });

  it("rejects malformed clues and a board of the wrong size", () => {
    const clues = cluesOf(["#.", ".#"]);

    expect(() => nextNonogramStep({ ...clues, size: 0 }, [])).toThrow(
      RangeError,
    );
    expect(() => nextNonogramStep(clues, board(["??"]))).toThrow(RangeError);
  });

  it("reveals the solution's cell, the one every arrangement of its line agrees on, on every weekday", () => {
    fc.assert(
      fc.property(
        seedArb,
        weekdayArb,
        densityArb,
        maskArb,
        (seed, weekday, density, mask) => {
          const { clues, reveal } = generateNonogram(seed, weekday);
          const solution = reveal.solution.flat();
          const bare = solution.map((): NonogramCellState => "unknown");
          const partial = solution.map((filled, i): NonogramCellState =>
            mask[i]! < density ? (filled ? "filled" : "empty") : "unknown",
          );
          for (const states of [bare, partial]) {
            const step = nextNonogramStep(clues, states);
            expect(step === null).toBe(!states.includes("unknown"));
            expect(nextNonogramStep(clues, states)).toEqual(step);
            if (step === null) {
              continue;
            }
            expect(step.value).toBe(solution[step.index] === true ? 1 : 0);
            expect(step).toEqual(bruteForceStep(clues, states));
          }
        },
      ),
      { seed: FC_SEED, numRuns: 200 },
    );
  });
});
