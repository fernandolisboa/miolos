import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createSeededRandom } from "../../src/index";
import { countQueensSolutions, solveQueens } from "../../src/queens/index";
import type { QueensBoard } from "../../src/queens/index";
import { board, instrumentSolutions, queens } from "./fixtures";

const UNBOUNDED = Number.MAX_SAFE_INTEGER;

function striped(size: number): QueensBoard {
  return {
    size,
    regions: Array.from({ length: size * size }, (_, cell) =>
      Math.floor(cell / size),
    ),
  };
}

function randomContiguousMap(size: number, seed: number): QueensBoard {
  const rng = createSeededRandom(seed);
  const regions = new Array<number>(size * size).fill(-1);
  for (let id = 0; id < size;) {
    const cell = rng.nextInt(size * size);
    if (regions[cell] === -1) {
      regions[cell] = id;
      id += 1;
    }
  }
  while (regions.includes(-1)) {
    const cell = rng.nextInt(size * size);
    const near = [cell - size, cell + size]
      .concat(cell % size > 0 ? [cell - 1] : [])
      .concat(cell % size < size - 1 ? [cell + 1] : [])
      .filter((next) => (regions[next] ?? -1) >= 0);
    if (regions[cell] === -1 && near.length > 0) {
      regions[cell] = regions[near[rng.nextInt(near.length)]!]!;
    }
  }
  return { size, regions };
}

describe("the N!-permutation instrument", () => {
  it("counts the non-touching permutations when every row is a region (OEIS A002464)", () => {
    expect(
      [4, 5, 6, 7].map((n) => instrumentSolutions(striped(n)).length),
    ).toEqual([2, 14, 90, 646]);
  });
});

describe("countQueensSolutions / solveQueens", () => {
  it("solves a 5×5 board with exactly one solution", () => {
    const five = board("00012 00022 22222 32422 33332");
    const only = queens("...Q. .Q... ....Q ..Q.. Q....");
    expect(instrumentSolutions(five)).toEqual([only]);
    expect(countQueensSolutions(five, UNBOUNDED)).toBe(1);
    expect(solveQueens(five)).toEqual(only);
  });

  it("counts a 6×6 board with two solutions and refuses to solve it", () => {
    const six = board("011112 001111 001111 001131 044115 005555");
    expect(instrumentSolutions(six)).toHaveLength(2);
    expect(countQueensSolutions(six, UNBOUNDED)).toBe(2);
    expect(countQueensSolutions(six, 1)).toBe(1);
    expect(solveQueens(six)).toBeNull();
  });

  it("counts zero on a 4×4 board whose region 0 holds two queens of both placements", () => {
    const four = board("1002 0000 3333 3333");
    expect(instrumentSolutions(four)).toEqual([]);
    expect(countQueensSolutions(four, UNBOUNDED)).toBe(0);
    expect(solveQueens(four)).toBeNull();
  });

  it("agrees with the instrument on every row-striped board", () => {
    for (const n of [4, 5, 6, 7]) {
      expect(countQueensSolutions(striped(n), UNBOUNDED)).toBe(
        instrumentSolutions(striped(n)).length,
      );
    }
  });

  it("property — agrees with the instrument on random contiguous maps, N = 4..7", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 7 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (size, seed) => {
          const map = randomContiguousMap(size, seed);
          const expected = instrumentSolutions(map);
          expect(countQueensSolutions(map, UNBOUNDED)).toBe(expected.length);
          expect(countQueensSolutions(map, 2)).toBe(
            Math.min(expected.length, 2),
          );
          expect(solveQueens(map)).toEqual(
            expected.length === 1 ? expected[0] : null,
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
