import { describe, expect, it } from "vitest";

import { defaultRemoteConfig, remoteConfigSchema } from "../src/index";

describe("remoteConfigSchema", () => {
  it("defaults bufferDepth to 7 on an empty object", () => {
    // #21 added attachStreakThreshold (default 5) and #145 added
    // pushOptInStreakThreshold (default 3) beside it; the exact default
    // object is re-pinned with every key in T-CORE-S54.
    expect(remoteConfigSchema.parse({})).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
    });
    expect(defaultRemoteConfig).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
    });
  });

  it("accepts an in-clamp override", () => {
    expect(remoteConfigSchema.parse({ bufferDepth: 3 })).toEqual({
      bufferDepth: 3,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
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
