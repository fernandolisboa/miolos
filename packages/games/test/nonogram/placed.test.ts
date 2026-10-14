import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { runLengths } from "../../src/nonogram/clues";
import { placedClues, type NonogramCellState } from "../../src/nonogram/index";
import { placedRuns } from "../../src/nonogram/placed";
import { FC_SEED } from "../daily-arbitraries";
import { board, cluesOf, consistent } from "./fixtures";

const RUNS = { seed: FC_SEED, numRuns: 500 };

const lineArb = fc.array(fc.boolean(), { minLength: 1, maxLength: 10 });
const stateArb = fc.constantFrom<NonogramCellState>(
  "filled",
  "empty",
  "unknown",
);
const statesArb = fc.array(stateArb, { minLength: 1, maxLength: 10 });
const runsArb = fc.array(fc.integer({ min: 1, max: 4 }), { maxLength: 4 });

function truth(filled: boolean): NonogramCellState {
  return filled ? "filled" : "empty";
}

function runStarts(arrangement: readonly boolean[]): number[] {
  return arrangement.flatMap((filled, k) =>
    filled && arrangement[k - 1] !== true ? [k] : [],
  );
}

function completions(
  states: readonly NonogramCellState[],
  runs: readonly number[],
): boolean[][] {
  return consistent({ runs, cells: states.map((_unused, k) => k) }, states);
}

function blocksOf(states: readonly NonogramCellState[]): number[] {
  return runLengths(states.map((state) => state === "filled"));
}

function equalRuns(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((run, i) => run === b[i]);
}

describe("placedRuns", () => {
  it("strikes only runs every completion of the marks places in the same cells, all of them filled", () => {
    let samples = 0;
    let completable = 0;
    fc.assert(
      fc.property(
        lineArb.chain((line) =>
          fc.tuple(
            fc.constant(line),
            fc.array(fc.boolean(), {
              minLength: line.length,
              maxLength: line.length,
            }),
            fc.array(fc.boolean(), {
              minLength: line.length,
              maxLength: line.length,
            }),
            fc.boolean(),
          ),
        ),
        ([line, hidden, other, ownClue]) => {
          const runs = runLengths(ownClue ? line : other);
          const states = line.map((filled, k): NonogramCellState =>
            hidden[k] === true ? "unknown" : truth(filled),
          );
          const matching = completions(states, runs);
          samples += 1;
          if (matching.length === 0) {
            return;
          }
          completable += 1;
          const placed = placedRuns(states, runs);
          for (const [i, struck] of placed.entries()) {
            if (!struck) {
              continue;
            }
            const starts = matching.map((option) => runStarts(option)[i]);
            expect(new Set(starts).size).toBe(1);
            const start = starts[0]!;
            for (let k = start; k < start + runs[i]!; k += 1) {
              expect(states[k]).toBe("filled");
            }
          }
        },
      ),
      RUNS,
    );
    expect(completable / samples).toBeGreaterThan(0.5);
  });

  it("strikes every number when the line's filled blocks are its clue", () => {
    fc.assert(
      fc.property(statesArb, (states) => {
        const runs = blocksOf(states);
        expect(placedRuns(states, runs)).toEqual(runs.map(() => true));
      }),
      RUNS,
    );
  });

  it("on a fully decided line strikes every number iff its blocks are the clue, else none", () => {
    fc.assert(
      fc.property(lineArb, runsArb, fc.boolean(), (line, other, ownClue) => {
        const states = line.map(truth);
        const runs = ownClue ? runLengths(line) : other;
        const exact = equalRuns(runLengths(line), runs);
        expect(placedRuns(states, runs)).toEqual(runs.map(() => exact));
      }),
      RUNS,
    );
  });

  it("strikes nothing when the two decided ends show more runs than the clue holds", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 3 }), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.integer({ min: 1, max: 3 }),
        fc.nat(),
        fc.nat(),
        (runs, gap, left, right) => {
          const k = runs.length;
          const a = 1 + (left % k);
          const b = k - a + 1 + (right % a);
          const shown = (part: readonly number[]): NonogramCellState[] =>
            part.flatMap((run) => [
              ...new Array<NonogramCellState>(run).fill("filled"),
              "empty",
            ]);
          const states = [
            ...shown(runs.slice(0, a)),
            ...new Array<NonogramCellState>(gap).fill("unknown"),
            ...shown(runs.slice(k - b).reverse()).reverse(),
          ];
          expect(placedRuns(states, runs)).toEqual(runs.map(() => false));
        },
      ),
      RUNS,
    );
  });

  it("strikes nothing when the decided cells alone hold more than the clue allows", () => {
    fc.assert(
      fc.property(statesArb, runsArb, (states, runs) => {
        const blocks = blocksOf(states);
        const groups = states
          .map((state) =>
            state === "empty" ? "x" : state === "filled" ? "#" : "?",
          )
          .join("")
          .split("x")
          .filter((segment) => segment.includes("#")).length;
        const tooMuch =
          blocks.reduce((sum, block) => sum + block, 0) >
            runs.reduce((sum, run) => sum + run, 0) ||
          blocks.some((block) => runs.every((run) => run < block)) ||
          groups > runs.length;
        fc.pre(tooMuch);
        expect(placedRuns(states, runs)).toEqual(runs.map(() => false));
      }),
      RUNS,
    );
  });

  it("is mirror-symmetric", () => {
    fc.assert(
      fc.property(statesArb, runsArb, (states, runs) => {
        expect(placedRuns([...states].reverse(), [...runs].reverse())).toEqual(
          [...placedRuns(states, runs)].reverse(),
        );
      }),
      RUNS,
    );
  });

  it("never unstrikes a number while marks toward one solution are added, in any order", () => {
    fc.assert(
      fc.property(
        lineArb.chain((line) =>
          fc.tuple(
            fc.constant(line),
            fc.shuffledSubarray(
              line.map((_unused, k) => k),
              { minLength: line.length, maxLength: line.length },
            ),
          ),
        ),
        ([line, order]) => {
          const runs = runLengths(line);
          const states = line.map((): NonogramCellState => "unknown");
          let before = placedRuns(states, runs);
          for (const k of order) {
            states[k] = truth(line[k]!);
            const after = placedRuns(states, runs);
            before.forEach((struck, i) => {
              if (struck) {
                expect(after[i]).toBe(true);
              }
            });
            before = after;
          }
          expect(before).toEqual(runs.map(() => true));
        },
      ),
      RUNS,
    );
  });

  it("is deterministic", () => {
    fc.assert(
      fc.property(statesArb, runsArb, (states, runs) => {
        expect(placedRuns(states, runs)).toEqual(placedRuns(states, runs));
      }),
      RUNS,
    );
  });

  it.each([
    { runs: [3], line: "?###?", placed: [true] },
    { runs: [1, 3], line: "?x###x?", placed: [false, false] },
    { runs: [2, 1], line: "##x##x?", placed: [false, false] },
    { runs: [2, 1], line: "##x#x#?", placed: [false, false] },
    { runs: [1], line: "#x#??", placed: [false] },
    { runs: [1, 1], line: "#x#?x#", placed: [false, false] },
    { runs: [1, 1], line: "#x#x#?????", placed: [false, false] },
    {
      runs: [1, 1, 1, 3],
      line: "#x####????????",
      placed: [false, false, false, false],
    },
    { runs: [2, 1], line: "##???", placed: [false, false] },
    { runs: [1, 1], line: "#?#??", placed: [true, true] },
    { runs: [1], line: "#x#", placed: [false] },
    { runs: [1], line: "#x?x#", placed: [false] },
    { runs: [], line: "??x", placed: [] },
  ])("strikes $placed for $runs on $line", ({ runs, line, placed }) => {
    expect(placedRuns(board([line]), runs)).toEqual(placed);
  });
});

describe("placedClues", () => {
  it("maps each row and column of the board to its struck numbers", () => {
    const clues = cluesOf(["#.#", "###", "..."]);

    expect(placedClues(clues, board(["#x?", "###", "???"]))).toEqual({
      rows: [[true, false], [true], []],
      cols: [[true], [true], [false]],
    });
  });

  it("rejects malformed clues and a board of the wrong size", () => {
    const clues = cluesOf(["#.", ".#"]);

    expect(() => placedClues({ ...clues, size: 0 }, [])).toThrow(RangeError);
    expect(() => placedClues(clues, board(["??"]))).toThrow(RangeError);
  });
});
