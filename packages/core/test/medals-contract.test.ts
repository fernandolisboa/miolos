import { describe, expect, it } from "vitest";

import { medalIdSchema, medalsResponseSchema } from "../src/index";

/**
 * The #30 wire contract (ADR-0052; ADR-0051 decision 3's "own endpoint
 * and contract"). The SHAPE is closed — strict on keys, ADR-0048
 * decision 3 — while the id SET is deliberately open: ids validate by the
 * slug grammar, never by enum, so catalog growth is additive content and
 * a deployed client's parse survives deploy skew.
 */
describe("medalsResponseSchema / medalIdSchema (ADR-0052)", () => {
  it("T-CORE-S77: strict on keys, shape-validated ids — a shape-valid UNKNOWN id parses (the skew posture) — duplicates and >64 ids fail, empty parses", () => {
    // Round trips: a real answer and the honest empty answer both parse.
    expect(
      medalsResponseSchema.parse({ medals: ["first-win", "founder"] }),
    ).toEqual({ medals: ["first-win", "founder"] });
    expect(medalsResponseSchema.parse({ medals: [] })).toEqual({ medals: [] });

    // Strict on keys: growth of the SHAPE is a new contract, never a new
    // field on this one.
    expect(
      medalsResponseSchema.safeParse({ medals: [], earnedDates: [] }).success,
    ).toBe(false);
    expect(
      medalsResponseSchema.safeParse({ medals: [], date: "2026-08-13" })
        .success,
    ).toBe(false);

    // A shape-INVALID id fails: the slug grammar is the DB CHECK's.
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
    // An id past 64 characters fails the shape bound.
    expect(medalIdSchema.safeParse("a".repeat(65)).success).toBe(false);
    expect(medalIdSchema.safeParse("a".repeat(64)).success).toBe(true);

    // The skew posture, asserted POSITIVELY: a shape-valid id UNKNOWN to
    // any catalog parses fine — the client drops it at render, and a
    // user's medal history never disappears because the server learned a
    // new medal first (ADR-0052's honesty mechanism).
    expect(
      medalsResponseSchema.safeParse({ medals: ["medal-from-the-future"] })
        .success,
    ).toBe(true);

    // Duplicate ids fail: the set semantics are enforced on the wire.
    expect(
      medalsResponseSchema.safeParse({ medals: ["founder", "founder"] })
        .success,
    ).toBe(false);

    // The sanity cap: 64 distinct ids parse, 65 fail. Deliberately
    // DECOUPLED from the catalog length — coupling would recreate the
    // deploy-skew break the shape validation exists to avoid.
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
