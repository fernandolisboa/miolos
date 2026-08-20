import { describe, expect, it } from "vitest";

import {
  onboardingSeenResponseSchema,
  onboardingSeenSchema,
  onboardingStateResponseSchema,
} from "../src/index";

// The onboarding contracts (#35, ADR-0061; plan 057 D4). Strict on both
// ends throughout — the attach.ts register: every route parses before
// Response.json and the client parses on arrival, so payload growth is a
// NEW endpoint and contract, never an appended field.

describe("the onboarding schemas are strict on both ends (ADR-0048 decision 3)", () => {
  it("T-CORE-S98: an extra key fails every one of the three schemas; the state is one boolean, the seen body is the literal empty object, the seen response is the literal true", () => {
    // GET /onboarding/state — one derived boolean, nothing else.
    expect(onboardingStateResponseSchema.parse({ show: true })).toEqual({
      show: true,
    });
    expect(onboardingStateResponseSchema.parse({ show: false })).toEqual({
      show: false,
    });
    expect(
      onboardingStateResponseSchema.safeParse({ show: true, seenAt: "x" })
        .success,
    ).toBe(false);
    // The timestamp never ships: a value that is not a boolean fails.
    expect(onboardingStateResponseSchema.safeParse({ show: "true" }).success) //
      .toBe(false);
    expect(onboardingStateResponseSchema.safeParse({}).success).toBe(false);

    // POST /onboarding/seen — the strict EMPTY object: any key is a 400.
    expect(onboardingSeenSchema.parse({})).toEqual({});
    expect(onboardingSeenSchema.safeParse({ anything: true }).success).toBe(
      false,
    );
    expect(onboardingSeenSchema.safeParse(null).success).toBe(false);

    // Its response — a literal, like { dismissed: true }.
    expect(onboardingSeenResponseSchema.parse({ seen: true })).toEqual({
      seen: true,
    });
    expect(onboardingSeenResponseSchema.safeParse({ seen: false }).success) //
      .toBe(false);
    expect(
      onboardingSeenResponseSchema.safeParse({ seen: true, extra: 1 }).success,
    ).toBe(false);
  });
});
