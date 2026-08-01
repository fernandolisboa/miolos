import { describe, expect, it } from "vitest";

import { defaultRemoteConfig, remoteConfigSchema } from "../src/index";

describe("remoteConfigSchema", () => {
  it("defaults bufferDepth to 7 on an empty object", () => {
    expect(remoteConfigSchema.parse({})).toEqual({ bufferDepth: 7 });
    expect(defaultRemoteConfig).toEqual({ bufferDepth: 7 });
  });

  it("accepts an in-clamp override", () => {
    expect(remoteConfigSchema.parse({ bufferDepth: 3 })).toEqual({
      bufferDepth: 3,
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
