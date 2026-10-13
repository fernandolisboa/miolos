import { describe, expect, it } from "vitest";

import { hintAllowanceResponseSchema } from "../src/index";

describe("the hint allowance response (ADR-0098)", () => {
  it("T-CORE-S182: strict, one integer inside the key's bounds", () => {
    expect(
      hintAllowanceResponseSchema.parse({ freeHintsPerPuzzle: 5 }),
    ).toEqual({ freeHintsPerPuzzle: 5 });
    for (const bad of [
      {},
      { freeHintsPerPuzzle: 3, extra: true },
      { freeHintsPerPuzzle: 0 },
      { freeHintsPerPuzzle: 10 },
    ]) {
      expect(
        hintAllowanceResponseSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});
