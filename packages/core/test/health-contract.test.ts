import { describe, expect, it } from "vitest";

import { healthResponseSchema, type HealthResponse } from "../src/index";

describe("healthResponseSchema", () => {
  const valid: HealthResponse = {
    status: "ok",
    service: "api",
    timestamp: "2026-07-31T12:00:00.000Z",
  };

  it("parses and round-trips a valid payload", () => {
    expect(healthResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a wrong status", () => {
    expect(
      healthResponseSchema.safeParse({ ...valid, status: "down" }).success,
    ).toBe(false);
  });

  it("rejects a missing field", () => {
    const withoutTimestamp = { status: valid.status, service: valid.service };
    expect(healthResponseSchema.safeParse(withoutTimestamp).success).toBe(
      false,
    );
  });

  it("rejects a non-ISO timestamp", () => {
    expect(
      healthResponseSchema.safeParse({ ...valid, timestamp: "yesterday" })
        .success,
    ).toBe(false);
  });
});
