import { describe, expect, it } from "vitest";

import { apiRootResponseSchema, type ApiRootResponse } from "../src/index";

describe("apiRootResponseSchema", () => {
  const valid: ApiRootResponse = { service: "api" };

  it("parses and round-trips a valid payload", () => {
    expect(apiRootResponseSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a wrong service", () => {
    expect(apiRootResponseSchema.safeParse({ service: "web" }).success).toBe(
      false,
    );
  });

  it("rejects a missing field", () => {
    expect(apiRootResponseSchema.safeParse({}).success).toBe(false);
  });
});
