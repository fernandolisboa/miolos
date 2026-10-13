import { describe, expect, it } from "vitest";

import {
  adminConfigWriteSchema,
  adminMemberRemoveSchema,
  adminMemberWriteSchema,
  adminStateResponseSchema,
  remoteConfigField,
  remoteConfigKeySchema,
} from "../src/index";

const USER_ID = "0b6f3c1e-2d4a-4e8b-9f10-3a5c7d9e1f20";
const CONFIG = {
  bufferDepth: 7,
  attachStreakThreshold: 5,
  pushOptInStreakThreshold: 3,
  freeHintsPerPuzzle: 3,
};

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
      "freeHintsPerPuzzle",
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
      ["freeHintsPerPuzzle", 1, 9],
    ]);
  });
});

describe("the admin state response (ADR-0100)", () => {
  it("T-CORE-S183: strict, one variant per role, members only for a superuser", () => {
    const members = [
      { email: "ana@example.com", role: "superuser" },
      { email: "bia@example.com", role: "admin" },
    ];
    const states = [
      { role: "none", email: null },
      { role: "none", email: "zeca@example.com" },
      { role: "admin", email: "bia@example.com", config: CONFIG },
      { role: "superuser", email: "ana@example.com", config: CONFIG, members },
      {
        role: "superuser",
        email: "ana@example.com",
        config: CONFIG,
        members: [],
      },
    ];
    for (const state of states) {
      expect(adminStateResponseSchema.parse(state)).toEqual(state);
    }

    rejects(adminStateResponseSchema, [
      { email: null },
      { role: "owner", email: null },
      { role: "none" },
      { role: "none", email: "not-an-email" },
      { role: "none", email: null, config: CONFIG },
      { role: "admin", email: null, config: CONFIG },
      { role: "admin", email: "bia@example.com" },
      { role: "admin", email: "bia@example.com", config: CONFIG, members },
      { role: "superuser", email: "ana@example.com", config: CONFIG },
      { role: "admin", email: "bia@example.com", config: { bufferDepth: 7 } },
      {
        role: "admin",
        email: "bia@example.com",
        config: { ...CONFIG, someFutureTunable: 1 },
      },
      {
        role: "superuser",
        email: "ana@example.com",
        config: CONFIG,
        members: [{ email: "ana@example.com", role: "none" }],
      },
      {
        role: "superuser",
        email: "ana@example.com",
        config: CONFIG,
        members: [{ email: "ana@example.com", role: "admin", addedAt: 1 }],
      },
      { userId: USER_ID, config: null },
    ]);
  });
});

describe("the member writes (ADR-0100)", () => {
  it("T-CORE-S184: the upsert trims and lowercases the email and takes either role, nothing else", () => {
    for (const role of ["superuser", "admin"]) {
      expect(
        adminMemberWriteSchema.parse({ email: "  Ana@Example.COM ", role }),
      ).toEqual({ email: "ana@example.com", role });
    }
    rejects(adminMemberWriteSchema, [
      { email: "ana@example.com", role: "none" },
      { email: "ana@example.com", role: "owner" },
      { email: "ana@example.com" },
      { role: "admin" },
      { email: "not-an-email", role: "admin" },
      { email: `${"a".repeat(243)}@example.com`, role: "admin" },
      { email: "ana@example.com", role: "admin", extra: true },
    ]);
  });

  it("T-CORE-S185: the removal takes one normalised email, nothing else", () => {
    expect(
      adminMemberRemoveSchema.parse({ email: " Bia@Example.com" }),
    ).toEqual({ email: "bia@example.com" });
    rejects(adminMemberRemoveSchema, [
      {},
      { email: "not-an-email" },
      { email: `${"a".repeat(243)}@example.com` },
      { email: "bia@example.com", role: "admin" },
    ]);
  });
});
