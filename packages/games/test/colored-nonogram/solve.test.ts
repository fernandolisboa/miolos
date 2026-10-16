import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  coloredRuns,
  deriveColoredClues,
} from "../../src/colored-nonogram/clues";
import {
  solveColoredLine,
  solveColoredNonogram,
} from "../../src/colored-nonogram/solve";
import type { ColoredRun } from "../../src/colored-nonogram/types";
import { solveLine } from "../../src/nonogram/solve";
import type { NonogramCellState } from "../../src/nonogram/types";
import { FC_SEED } from "../daily-arbitraries";
import { propertyRuns } from "../property-runs";

const OPEN = 0b111;
const run = (tone: number, length: number): ColoredRun => ({ tone, length });

function fittingLines(
  domains: readonly number[],
  runs: readonly ColoredRun[],
): number[][] {
  const lines: number[][] = [[]];
  for (const domain of domains) {
    const tones = [0, 1, 2, 3].filter((tone) => (domain >> tone) & 1);
    lines.splice(
      0,
      lines.length,
      ...lines.flatMap((line) => tones.map((tone) => [...line, tone])),
    );
  }
  return lines.filter(
    (line) => JSON.stringify(coloredRuns(line)) === JSON.stringify(runs),
  );
}

const lineCaseArb = fc
  .integer({ min: 1, max: 3 })
  .chain((toneCount) =>
    fc.array(
      fc.record({
        tone: fc.integer({ min: 0, max: toneCount }),
        extra: fc.integer({ min: 0, max: (2 << toneCount) - 1 }),
      }),
      { minLength: 1, maxLength: 7 },
    ),
  )
  .map((cells) => ({
    truth: cells.map(({ tone }) => tone),
    domains: cells.map(({ tone, extra }) => (1 << tone) | extra),
  }));

const MONO_BITS: Record<NonogramCellState, number> = {
  empty: 0b01,
  filled: 0b10,
  unknown: 0b11,
};

describe("solveColoredLine", () => {
  it("lets different tones touch and keeps a gap between the same tone", () => {
    expect(
      solveColoredLine([OPEN, OPEN, OPEN], [run(1, 1), run(2, 2)]),
    ).toEqual([0b010, 0b100, 0b100]);
    expect(
      solveColoredLine([OPEN, OPEN, OPEN, OPEN], [run(1, 1), run(1, 2)]),
    ).toEqual([0b010, 0b001, 0b010, 0b010]);
    expect(solveColoredLine([OPEN, OPEN, OPEN], [run(1, 1), run(1, 2)])).toBe(
      null,
    );
  });

  it("keeps every true line's tone and drops only tones no fitting line uses", () => {
    fc.assert(
      fc.property(lineCaseArb, ({ truth, domains }) => {
        const solved = solveColoredLine(domains, coloredRuns(truth)) ?? [];
        truth.forEach((tone, k) => {
          expect((solved[k] ?? 0) & (1 << tone)).not.toBe(0);
        });
        const union = domains.map(() => 0);
        for (const line of fittingLines(domains, coloredRuns(truth))) {
          line.forEach((tone, k) => {
            union[k]! |= 1 << tone;
          });
        }
        expect(solved).toEqual(union);
      }),
      { seed: FC_SEED, numRuns: propertyRuns(500) },
    );
  });

  it("with one tone, agrees with solveLine", () => {
    const stateArb = fc.constantFrom<NonogramCellState>(
      "empty",
      "filled",
      "unknown",
    );
    fc.assert(
      fc.property(
        fc.array(stateArb, { minLength: 1, maxLength: 15 }),
        fc.array(fc.integer({ min: 1, max: 6 }), { maxLength: 5 }),
        (states, lengths) => {
          const mono = solveLine(states, lengths);
          const colored = solveColoredLine(
            states.map((state) => MONO_BITS[state]),
            lengths.map((length) => run(1, length)),
          );
          expect(colored).toEqual(
            mono.contradiction
              ? null
              : mono.states.map((state) => MONO_BITS[state]),
          );
        },
      ),
      { seed: FC_SEED, numRuns: propertyRuns(2000) },
    );
  });
});

describe("solveColoredNonogram", () => {
  it("solves a picture its lines fix to its palette indices", () => {
    const tones = ["rbb", ".r.", "bbr"].join("");

    expect(solveColoredNonogram(deriveColoredClues(3, tones))).toEqual([
      1, 2, 2, 0, 1, 0, 2, 2, 1,
    ]);
  });

  it("returns null for a picture its lines leave open", () => {
    expect(solveColoredNonogram(deriveColoredClues(2, "r..r"))).toBeNull();
  });
});
