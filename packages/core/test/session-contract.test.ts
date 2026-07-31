import { describe, expect, it } from "vitest";

import { sessionResponseSchema, type SessionResponse } from "../src/index";

describe("sessionResponseSchema", () => {
  const valid: SessionResponse = {
    userId: "3f8e9a2c-1b4d-4e6f-8a9b-0c1d2e3f4a5b",
    created: true,
  };

  it("parses and round-trips a valid payload", () => {
    expect(sessionResponseSchema.parse(valid)).toEqual(valid);
  });

  it("parses created: false", () => {
    const resolved = { ...valid, created: false };
    expect(sessionResponseSchema.parse(resolved)).toEqual(resolved);
  });

  it("rejects a non-uuid userId", () => {
    expect(
      sessionResponseSchema.safeParse({ ...valid, userId: "user-42" }).success,
    ).toBe(false);
  });

  it("rejects a missing created", () => {
    const withoutCreated = { userId: valid.userId };
    expect(sessionResponseSchema.safeParse(withoutCreated).success).toBe(false);
  });

  it("rejects wrong types", () => {
    expect(
      sessionResponseSchema.safeParse({ userId: 42, created: "yes" }).success,
    ).toBe(false);
  });
});
