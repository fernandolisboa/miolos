import { describe, expect, it } from "vitest";

import { medalIdSchema, medalsResponseSchema } from "../src/index";

describe("medalsResponseSchema / medalIdSchema (ADR-0052)", () => {
  it("T-CORE-S77: strict on keys, shape-validated ids — a shape-valid UNKNOWN id parses (the skew posture) — duplicates and >64 ids fail, empty parses", () => {
    expect(
      medalsResponseSchema.parse({ medals: ["first-win", "founder"] }),
    ).toEqual({ medals: ["first-win", "founder"] });
    expect(medalsResponseSchema.parse({ medals: [] })).toEqual({ medals: [] });

    expect(
      medalsResponseSchema.safeParse({ medals: [], earnedDates: [] }).success,
    ).toBe(false);
    expect(
      medalsResponseSchema.safeParse({ medals: [], date: "2026-08-13" })
        .success,
    ).toBe(false);

    for (const id of [
      "Founder",
      "first_win",
      "-leading",
      "trailing-",
      "a--b",
      "",
    ]) {
      expect(
        medalsResponseSchema.safeParse({ medals: [id] }).success,
        JSON.stringify(id),
      ).toBe(false);
    }

    expect(medalIdSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(medalIdSchema.safeParse("a".repeat(64)).success).toBe(true);

    expect(
      medalsResponseSchema.safeParse({ medals: ["medal-from-the-future"] })
        .success,
    ).toBe(true);

    expect(
      medalsResponseSchema.safeParse({ medals: ["founder", "founder"] })
        .success,
    ).toBe(false);

    const many = (n: number): string[] =>
      Array.from({ length: n }, (_, i) => `medal-${String(i)}`);
    expect(medalsResponseSchema.safeParse({ medals: many(64) }).success).toBe(
      true,
    );
    expect(medalsResponseSchema.safeParse({ medals: many(65) }).success).toBe(
      false,
    );
  });
});
