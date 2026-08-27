import { describe, expect, it } from "vitest";

import {
  onboardingSeenResponseSchema,
  onboardingSeenSchema,
  onboardingStateResponseSchema,
} from "../src/index";

describe("the onboarding schemas are strict on both ends (ADR-0048 decision 3)", () => {
  it("T-CORE-S98: an extra key fails every one of the three schemas; the state is one boolean, the seen body is the literal empty object, the seen response is the literal true", () => {
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

    expect(onboardingStateResponseSchema.safeParse({ show: "true" }).success) //
      .toBe(false);
    expect(onboardingStateResponseSchema.safeParse({}).success).toBe(false);

    expect(onboardingSeenSchema.parse({})).toEqual({});
    expect(onboardingSeenSchema.safeParse({ anything: true }).success).toBe(
      false,
    );
    expect(onboardingSeenSchema.safeParse(null).success).toBe(false);

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
