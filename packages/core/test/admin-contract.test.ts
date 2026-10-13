import { describe, expect, it } from "vitest";

import {
  adminConfigWriteSchema,
  adminStateResponseSchema,
  remoteConfigField,
  remoteConfigKeySchema,
} from "../src/index";

const USER_ID = "0b6f3c1e-2d4a-4e8b-9f10-3a5c7d9e1f20";

function rejects(
  schema: { safeParse: (value: unknown) => { success: boolean } },
  values: unknown[],
): void {
  for (const value of values) {
    expect(schema.safeParse(value).success, JSON.stringify(value)).toBe(false);
  }
}

describe("the admin config write (ADR-0097)", () => {
  it("T-CORE-S170: one known key and an integer inside that key's bounds, nothing else", () => {
    expect(
      adminConfigWriteSchema.safeParse({ key: "bufferDepth", value: 31 })
        .success,
    ).toBe(false);

    for (const key of remoteConfigKeySchema.options) {
      const field = remoteConfigField(key);
      const min = field.minValue ?? Number.NaN;
      const max = field.maxValue ?? Number.NaN;
      for (const value of [min, max]) {
        expect(adminConfigWriteSchema.parse({ key, value })).toEqual({
          key,
          value,
        });
      }
      rejects(adminConfigWriteSchema, [
        { key, value: min - 1 },
        { key, value: max + 1 },
        { key, value: 7.5 },
        { key, value: "7" },
        { key },
        { key, value: min, extra: true },
      ]);
    }
    rejects(adminConfigWriteSchema, [
      { key: "someFutureTunable", value: 3 },
      { value: 3 },
      {},
    ]);
  });

  it("T-CORE-S171: the keys and their bounds are the remote-config schema's", () => {
    expect(remoteConfigKeySchema.options).toEqual([
      "bufferDepth",
      "attachStreakThreshold",
      "pushOptInStreakThreshold",
    ]);
    expect(
      remoteConfigKeySchema.options.map((key) => {
        const field = remoteConfigField(key);
        return [key, field.minValue, field.maxValue];
      }),
    ).toEqual([
      ["bufferDepth", 1, 30],
      ["attachStreakThreshold", 1, 365],
      ["pushOptInStreakThreshold", 1, 365],
    ]);
  });
});

describe("the admin state response (ADR-0097)", () => {
  it("T-CORE-S172: strict, the viewer's own id, and every key or a null config", () => {
    const config = {
      bufferDepth: 7,
      attachStreakThreshold: 5,
      pushOptInStreakThreshold: 3,
    };
    expect(
      adminStateResponseSchema.parse({ userId: USER_ID, config: null }),
    ).toEqual({ userId: USER_ID, config: null });
    expect(adminStateResponseSchema.parse({ userId: USER_ID, config })).toEqual(
      { userId: USER_ID, config },
    );

    rejects(adminStateResponseSchema, [
      { userId: USER_ID },
      { config: null },
      { userId: "not-a-uuid", config: null },
      { userId: USER_ID, config: null, role: "admin" },
      { userId: USER_ID, config: { bufferDepth: 7 } },
      { userId: USER_ID, config: { ...config, someFutureTunable: 1 } },
      { userId: USER_ID, config: { ...config, bufferDepth: 31 } },
    ]);
  });
});
