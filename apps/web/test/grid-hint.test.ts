import {
  generateBinairo,
  solveBinairo,
  type BinairoCell,
} from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import { nextBinaryHint, nextHint } from "../src/play/grid-hint";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

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

describe("nextBinaryHint: a wrong cell first, then a 1 before a 0 (T-WEB-S458)", () => {
  const solution = [0, 0, 1, 0, 1, 0] as const;

  it("corrects the first wrong cell in row-major order, either way round", () => {
    expect(nextBinaryHint(solution, [null, 1, null, null, 0, null])).toEqual({
      index: 1,
      value: 0,
      kind: "correction",
    });
    expect(nextBinaryHint(solution, [null, null, 0, null, null, 1])).toEqual({
      index: 2,
      value: 1,
      kind: "correction",
    });
  });

  it("reveals the first empty 1 even when an empty 0 comes before it", () => {
    expect(
      nextBinaryHint(solution, [null, null, null, null, null, null]),
    ).toEqual({ index: 2, value: 1, kind: "fill" });
  });

  it("reveals a 0 only once every 1 is in place", () => {
    expect(nextBinaryHint(solution, [null, 0, 1, null, 1, null])).toEqual({
      index: 0,
      value: 0,
      kind: "fill",
    });
  });

  it("returns null on a finished board", () => {
    expect(nextBinaryHint(solution, [0, 0, 1, 0, 1, 0])).toBeNull();
  });
});
