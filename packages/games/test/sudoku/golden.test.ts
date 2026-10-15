import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { PEERS, UNITS } from "../../src/sudoku/board";
import { generateDailySudoku, type Weekday } from "../../src/sudoku/index";

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const SEEDS: readonly number[] = [0, 1];

const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("the classic Sudoku is byte-identical to its golden hashes", () => {
  it("keeps the classic unit and peer tables", () => {
    expect(sha256({ units: UNITS, peers: PEERS })).toBe(
      "d4482b59fb3ea1987348b56403e204c2aca50805586bf69fc0b1992cb4235bed",
    );
  });

  it("generates the same daily puzzles for two seeds per weekday", () => {
    const puzzles = SEEDS.flatMap((seed) =>
      WEEKDAYS.map((weekday) => generateDailySudoku({ seed, weekday })),
    );
    expect(sha256(puzzles)).toBe(
      "a07034432da2f9c7051217f9b3e3932c09538583f3971495821227aec0355e60",
    );
  }, 30_000);
});
