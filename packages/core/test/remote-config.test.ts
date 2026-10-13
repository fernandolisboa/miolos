import { describe, expect, it } from "vitest";

import {
  defaultRemoteConfig,
  FREE_HINTS_PER_PUZZLE,
  HINTS_PER_PUZZLE_CEILING,
  hintsUsedSchema,
  remoteConfigField,
  remoteConfigSchema,
} from "../src/index";

describe("remoteConfigSchema", () => {
  it("defaults bufferDepth to 7 on an empty object", () => {
    expect(remoteConfigSchema.parse({})).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
    });
    expect(defaultRemoteConfig).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
    });
  });

  it("accepts an in-clamp override", () => {
    expect(remoteConfigSchema.parse({ bufferDepth: 3 })).toEqual({
      bufferDepth: 3,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
      freeHintsPerPuzzle: 3,
    });
  });

  it("rejects out-of-clamp and non-integer depths (loop bounds are never unclamped)", () => {
    expect(remoteConfigSchema.safeParse({ bufferDepth: 0 }).success).toBe(
      false,
    );
    expect(remoteConfigSchema.safeParse({ bufferDepth: 31 }).success).toBe(
      false,
    );
    expect(remoteConfigSchema.safeParse({ bufferDepth: 500 }).success).toBe(
      false,
    );
    expect(remoteConfigSchema.safeParse({ bufferDepth: 6.5 }).success).toBe(
      false,
    );
    expect(remoteConfigSchema.safeParse({ bufferDepth: "7" }).success).toBe(
      false,
    );
  });
});

describe("remoteConfigSchema.freeHintsPerPuzzle (ADR-0098)", () => {
  it("T-CORE-S180: defaults to FREE_HINTS_PER_PUZZLE, takes 1 to 9, nothing else", () => {
    expect(remoteConfigSchema.parse({}).freeHintsPerPuzzle).toBe(
      FREE_HINTS_PER_PUZZLE,
    );
    for (const value of [1, 9]) {
      expect(
        remoteConfigSchema.parse({ freeHintsPerPuzzle: value })
          .freeHintsPerPuzzle,
      ).toBe(value);
    }
    for (const bad of [0, 10, 2.5, "3"]) {
      expect(
        remoteConfigSchema.safeParse({ freeHintsPerPuzzle: bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });

  it("T-CORE-S181: the key's maximum is the wire ceiling hintsUsedSchema enforces", () => {
    expect(remoteConfigField("freeHintsPerPuzzle").maxValue).toBe(
      HINTS_PER_PUZZLE_CEILING,
    );
    expect(hintsUsedSchema.maxValue).toBe(HINTS_PER_PUZZLE_CEILING);
  });
});
