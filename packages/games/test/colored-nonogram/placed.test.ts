import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { coloredRuns } from "../../src/colored-nonogram/clues";
import {
  formsColoredClue,
  placedColoredClues,
} from "../../src/colored-nonogram/index";
import { placedColoredRuns } from "../../src/colored-nonogram/placed";
import { coloredLines } from "../../src/colored-nonogram/solve";
import type { ColoredRun } from "../../src/colored-nonogram/types";
import { placedRuns } from "../../src/nonogram/placed";
import type { NonogramCellState } from "../../src/nonogram/types";
import { FC_SEED } from "../daily-arbitraries";
import { propertyRuns } from "../property-runs";
import {
  COLORED_SIZES,
  fittingLines,
  poolIds,
  variantPuzzle,
} from "./fixtures";

type Mark = number | null;

const RUNS = { seed: FC_SEED, numRuns: propertyRuns(500) };
const ALL_TONES = 0b1111;

const toneArb = fc.integer({ min: 0, max: 3 });
const lineArb = fc.array(toneArb, { minLength: 1, maxLength: 7 });
const marksArb = fc.array(fc.option(toneArb, { nil: null }), {
  minLength: 1,
  maxLength: 7,
});
const runsArb = fc.array(
  fc.record({
    tone: fc.integer({ min: 1, max: 3 }),
    length: fc.integer({ min: 1, max: 3 }),
  }),
  { maxLength: 4 },
);

function line(text: string): Mark[] {
  return [...text].map((ch) =>
    ch === "?" ? null : ch === "x" ? 0 : ch.charCodeAt(0) - 64,
  );
}

function clue(text: string): ColoredRun[] {
  return text
    .split(" ")
    .filter((run) => run !== "")
    .map((run) => ({
      tone: run.charCodeAt(0) - 64,
      length: Number(run.slice(1)),
    }));
}

function runStarts(tones: readonly number[]): number[] {
  return tones.flatMap((tone, k) =>
    tone !== 0 && tone !== tones[k - 1] ? [k] : [],
  );
}

function sameRuns(a: readonly ColoredRun[], b: readonly ColoredRun[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function completions(marks: readonly Mark[], runs: readonly ColoredRun[]) {
  return fittingLines(
    marks.map((mark) => (mark === null ? ALL_TONES : 1 << mark)),
    runs,
  );
}

function toneTotals(tones: readonly number[], weights: readonly number[]) {
  const totals = new Map<number, number>();
  tones.forEach((tone, k) => {
    totals.set(tone, (totals.get(tone) ?? 0) + (weights[k] ?? 0));
  });
  return totals;
}

function overCounted(marks: readonly Mark[], runs: readonly ColoredRun[]) {
  const painted = marks.filter((mark): mark is number => (mark ?? 0) > 0);
  const have = toneTotals(
    painted,
    painted.map(() => 1),
  );
  const allowed = toneTotals(
    runs.map((run) => run.tone),
    runs.map((run) => run.length),
  );
  return [...have].some(([tone, count]) => count > (allowed.get(tone) ?? 0));
}

function overLong(marks: readonly Mark[], runs: readonly ColoredRun[]) {
  return marks.some((mark, k) => {
    if (mark === null || mark === 0) {
      return false;
    }
    let end = k;
    while (marks[end] === mark) {
      end += 1;
    }
    return runs.every((run) => run.tone !== mark || run.length < end - k);
  });
}

function overGrouped(marks: readonly Mark[], runs: readonly ColoredRun[]) {
  const groups = marks
    .map((mark) => (mark === null ? "" : String(mark)))
    .join("")
    .split("0")
    .reduce(
      (sum, segment) =>
        sum + [...segment].filter((tone, k) => tone !== segment[k - 1]).length,
      0,
    );
  return groups > runs.length;
}

describe("placedColoredRuns", () => {
  it("strikes only runs every completion of the marks places in the same cells, all of them painted in the run's tone", () => {
    let samples = 0;
    let completable = 0;
    fc.assert(
      fc.property(
        lineArb.chain((truth) =>
          fc.tuple(
            fc.constant(truth),
            fc.array(fc.boolean(), {
              minLength: truth.length,
              maxLength: truth.length,
            }),
            fc.array(toneArb, {
              minLength: truth.length,
              maxLength: truth.length,
            }),
            fc.boolean(),
          ),
        ),
        ([truth, hidden, other, ownClue]) => {
          const runs = coloredRuns(ownClue ? truth : other);
          const marks = truth.map((tone, k) =>
            hidden[k] === true ? null : tone,
          );
          const matching = completions(marks, runs);
          samples += 1;
          if (matching.length === 0) {
            return;
          }
          completable += 1;
          for (const [i, struck] of placedColoredRuns(marks, runs).entries()) {
            if (!struck) {
              continue;
            }
            const starts = matching.map((option) => runStarts(option)[i]);
            expect(new Set(starts).size).toBe(1);
            const start = starts[0]!;
            for (let k = start; k < start + runs[i]!.length; k += 1) {
              expect(marks[k]).toBe(runs[i]!.tone);
            }
          }
        },
      ),
      RUNS,
    );
    expect(completable / samples).toBeGreaterThan(0.5);
  });

  it("with one tone, agrees with the Clássico strike", () => {
    const stateArb = fc.constantFrom<NonogramCellState>(
      "filled",
      "empty",
      "unknown",
    );
    const MARK: Record<NonogramCellState, Mark> = {
      filled: 1,
      empty: 0,
      unknown: null,
    };
    fc.assert(
      fc.property(
        fc.array(stateArb, { minLength: 1, maxLength: 10 }),
        fc.array(fc.integer({ min: 1, max: 4 }), { maxLength: 4 }),
        (states, lengths) => {
          expect(
            placedColoredRuns(
              states.map((state) => MARK[state]),
              lengths.map((length) => ({ tone: 1, length })),
            ),
          ).toEqual(placedRuns(states, lengths));
        },
      ),
      RUNS,
    );
  });

  it("strikes every number when the line's painted blocks are its clue", () => {
    fc.assert(
      fc.property(marksArb, (marks) => {
        const runs = coloredRuns(marks.map((mark) => mark ?? 0));
        expect(placedColoredRuns(marks, runs)).toEqual(runs.map(() => true));
      }),
      RUNS,
    );
  });

  it("on a fully decided line strikes every number iff its runs are the clue, else none", () => {
    fc.assert(
      fc.property(lineArb, runsArb, fc.boolean(), (tones, other, ownClue) => {
        const runs = ownClue ? coloredRuns(tones) : other;
        const exact = sameRuns(coloredRuns(tones), runs);
        expect(placedColoredRuns(tones, runs)).toEqual(runs.map(() => exact));
      }),
      RUNS,
    );
  });

  for (const [name, check] of [
    ["more cells of a tone than its numbers add up to", overCounted],
    ["a block longer than every number of its tone", overLong],
    ["more groups than numbers", overGrouped],
  ] as const) {
    it(`strikes nothing when the decided cells show ${name}`, () => {
      fc.assert(
        fc.property(marksArb, runsArb, (marks, runs) => {
          fc.pre(check(marks, runs));
          expect(placedColoredRuns(marks, runs)).toEqual(runs.map(() => false));
        }),
        RUNS,
      );
    });
  }

  it("is mirror-symmetric", () => {
    fc.assert(
      fc.property(marksArb, runsArb, (marks, runs) => {
        expect(
          placedColoredRuns([...marks].reverse(), [...runs].reverse()),
        ).toEqual([...placedColoredRuns(marks, runs)].reverse());
      }),
      RUNS,
    );
  });

  it("never unstrikes a number while marks toward one solution are added, in any order", () => {
    fc.assert(
      fc.property(
        lineArb.chain((truth) =>
          fc.tuple(
            fc.constant(truth),
            fc.shuffledSubarray(
              truth.map((_unused, k) => k),
              { minLength: truth.length, maxLength: truth.length },
            ),
          ),
        ),
        ([truth, order]) => {
          const runs = coloredRuns(truth);
          const marks = truth.map((): Mark => null);
          let before = placedColoredRuns(marks, runs);
          for (const k of order) {
            marks[k] = truth[k]!;
            const after = placedColoredRuns(marks, runs);
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

  it.each([
    { runs: "A2 B1 A1", marks: "AAB????", placed: [true, false, false] },
    { runs: "A1 B2", marks: "AB?", placed: [true, false] },
    { runs: "A1 A2", marks: "AAA??", placed: [false, false] },
    { runs: "A1 A1", marks: "AA???", placed: [false, false] },
    { runs: "A1 B1 A1", marks: "AxB?B?xA", placed: [false, false, false] },
    {
      runs: "A1 B1 B1 A1",
      marks: "AxBB?xA",
      placed: [false, false, false, false],
    },
    {
      runs: "A1 B2 C2 A1",
      marks: "AxBCBC?xA",
      placed: [false, false, false, false],
    },
    { runs: "B1 A1", marks: "AB?", placed: [false, false] },
    { runs: "A1 B1", marks: "A?B", placed: [true, true] },
    { runs: "A3 A1", marks: "?xAxA", placed: [false, true] },
    { runs: "A3 A1", marks: "A?AxA", placed: [false, true] },
    { runs: "", marks: "??x", placed: [] },
  ])("strikes $placed for $runs on $marks", ({ runs, marks, placed }) => {
    expect(placedColoredRuns(line(marks), clue(runs))).toEqual(placed);
  });
});

describe("formsColoredClue", () => {
  it.each([
    { runs: "A1 B2", marks: "AB?B?", forms: false },
    { runs: "A1 B2", marks: "ABB??", forms: true },
    { runs: "A2", marks: "?AA?x", forms: true },
    { runs: "A1 A1", marks: "AA???", forms: false },
    { runs: "A1 B1", marks: "BA???", forms: false },
    { runs: "", marks: "x??x?", forms: true },
  ])("is $forms for $runs on $marks", ({ runs, marks, forms }) => {
    expect(formsColoredClue(line(marks), clue(runs))).toBe(forms);
  });
});

describe("placedColoredClues", () => {
  it("strikes only runs at their solution cells for any subset of a pool picture's marks", () => {
    const ids = COLORED_SIZES.flatMap(poolIds);
    fc.assert(
      fc.property(
        fc.constantFrom(...ids),
        fc.infiniteStream(fc.boolean()),
        (id, keep) => {
          const { clues, solution } = variantPuzzle(id);
          const marks = solution.map((tone) =>
            keep.next().value ? tone : null,
          );
          const placed = placedColoredClues(clues, marks);
          const struck = [...placed.rows, ...placed.cols];
          coloredLines(clues).forEach(({ cells, runs }, k) => {
            const truth = cells.map((cell) => solution[cell]!);
            const starts = runStarts(truth);
            struck[k]!.forEach((hit, i) => {
              if (!hit) {
                return;
              }
              for (let at = 0; at < runs[i]!.length; at += 1) {
                expect(marks[cells[starts[i]! + at]!], id).toBe(runs[i]!.tone);
              }
            });
          });
        },
      ),
      { seed: FC_SEED, numRuns: propertyRuns(200) },
    );
  });

  it("maps each row and column of the board to its struck numbers", () => {
    const clues = {
      size: 3,
      palette: ["r", "b"] as const,
      rows: [clue("A1 B1"), clue("B3"), clue("A1")],
      cols: [clue("A1 B1 A1"), clue("B1"), clue("B2")],
    };

    expect(placedColoredClues(clues, line("AxB" + "B??" + "???"))).toEqual({
      rows: [[true, true], [false], [false]],
      cols: [[true, false, false], [false], [false]],
    });
  });
});
