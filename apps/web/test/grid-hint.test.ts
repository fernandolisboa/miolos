import {
  generateBinairo,
  solveBinairo,
  type BinairoCell,
} from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import { nextHint } from "../src/play/grid-hint";

// T-WEB-10/T-WEB-11, carried forward as T-WEB-S9/S10's binairo half
// (plan 018 §15). `nextHint` is pure and deterministic,
// so it is proved directly rather than through the button. Table-driven,
// deliberately: ADR-0017 scopes fast-check to packages/games and this
// ticket adds no test dependency.

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

// Twenty pinned seeds, in-file so a failure is reproducible from the
// source alone. Arbitrary values, never a clock or a random draw.
const SEEDS = [
  1, 2, 3, 7, 11, 42, 101, 512, 1_009, 4_242, 20_260_101, 20_260_214,
  20_260_331, 20_260_430, 20_260_531, 20_260_630, 20_260_730, 20_260_831,
  20_260_930, 4_294_967_295,
] as const;

const puzzle = generateBinairo({ seed: 20_260_730, weekday: 3 });
const emptyEntries: readonly BinairoCell[] = Array.from(
  { length: 64 },
  () => null,
);

/** Row-major index of the first cell the player is free to fill. */
function firstFreeIndex(givens: readonly BinairoCell[]): number {
  return givens.findIndex((cell) => cell === null);
}

describe("nextHint", () => {
  it("fills the first empty non-given cell in row-major order", () => {
    const hint = nextHint(puzzle.solution, puzzle.givens, emptyEntries);

    expect(hint).not.toBeNull();
    expect(hint?.kind).toBe("fill");
    expect(hint?.index).toBe(firstFreeIndex(puzzle.givens));
    expect(hint?.value).toBe(puzzle.solution[firstFreeIndex(puzzle.givens)]);
  });

  it("prefers correcting a contradicting entry over filling an empty cell", () => {
    const free = puzzle.givens
      .map((cell, index) => (cell === null ? index : -1))
      .filter((index) => index !== -1);
    const wrongAt = free.at(-1) ?? -1;
    expect(wrongAt).toBeGreaterThan(firstFreeIndex(puzzle.givens));

    const entries = [...emptyEntries];
    entries[wrongAt] = puzzle.solution[wrongAt] === 1 ? 0 : 1;

    const hint = nextHint(puzzle.solution, puzzle.givens, entries);

    expect(hint).toEqual({
      index: wrongAt,
      value: puzzle.solution[wrongAt],
      kind: "correction",
    });
  });

  it("takes the first contradiction in row-major order when several exist", () => {
    const free = puzzle.givens
      .map((cell, index) => (cell === null ? index : -1))
      .filter((index) => index !== -1);
    const [earlier, later] = [free[1], free.at(-1)];
    expect(earlier).toBeDefined();
    expect(later).toBeDefined();

    const entries = [...emptyEntries];
    for (const index of [earlier ?? 0, later ?? 0]) {
      entries[index] = puzzle.solution[index] === 1 ? 0 : 1;
    }

    expect(nextHint(puzzle.solution, puzzle.givens, entries)?.index).toBe(
      earlier,
    );
  });

  it("is deterministic: the same state in gives the same hint out", () => {
    const first = nextHint(puzzle.solution, puzzle.givens, emptyEntries);
    const second = nextHint(puzzle.solution, puzzle.givens, emptyEntries);

    expect(first).toEqual(second);
  });

  it("returns null once the grid is complete and correct", () => {
    const entries = puzzle.solution.map((value, index) =>
      puzzle.givens[index] === null ? value : null,
    );

    expect(nextHint(puzzle.solution, puzzle.givens, entries)).toBeNull();
  });

  it("never touches a given, even one the player somehow contradicts", () => {
    const givenIndex = puzzle.givens.findIndex((cell) => cell !== null);
    const entries = [...emptyEntries];
    entries[givenIndex] = puzzle.givens[givenIndex] === 1 ? 0 : 1;

    const hint = nextHint(puzzle.solution, puzzle.givens, entries);

    expect(hint?.index).not.toBe(givenIndex);
    expect(hint?.kind).toBe("fill");
  });

  it("holds for every weekday's puzzle", () => {
    for (const weekday of WEEKDAYS) {
      const daily = generateBinairo({ seed: 7_777, weekday });
      const hint = nextHint(daily.solution, daily.givens, emptyEntries);

      expect(hint?.kind).toBe("fill");
      expect(hint?.index).toBe(firstFreeIndex(daily.givens));

      const solvedEntries = daily.solution.map((value, index) =>
        daily.givens[index] === null ? value : null,
      );
      expect(nextHint(daily.solution, daily.givens, solvedEntries)).toBeNull();
    }
  });
});

describe("nextHint always agrees with the solver (T-WEB-11)", () => {
  // 7 weekdays × 20 pinned seeds. The hint is computed on the client from
  // the published givens (ADR-0027), so the property that matters is that
  // it never reveals anything but what `solveBinairo(givens)` already
  // recovers — the hint can never be more informative than the board.
  it.each(WEEKDAYS)("weekday %i", (weekday) => {
    for (const seed of SEEDS) {
      const daily = generateBinairo({ seed, weekday });
      const recovered = solveBinairo(daily.givens);
      expect(recovered).not.toBeNull();
      if (recovered === null) {
        continue;
      }

      const fill = nextHint(recovered, daily.givens, emptyEntries);
      expect(fill).not.toBeNull();
      expect(fill?.value).toBe(recovered[fill?.index ?? -1]);

      const wrongAt = daily.givens.findLastIndex((cell) => cell === null);
      const entries = [...emptyEntries];
      entries[wrongAt] = recovered[wrongAt] === 1 ? 0 : 1;
      const correction = nextHint(recovered, daily.givens, entries);
      expect(correction).toEqual({
        index: wrongAt,
        value: recovered[wrongAt],
        kind: "correction",
      });
    }
  });
});
