import { describe, expect, it } from "vitest";

import {
  accountDeleteResponseSchema,
  accountDeleteSchema,
  attachConfirmResponseSchema,
  attachConfirmSchema,
  attachDismissResponseSchema,
  attachDismissSchema,
  attachEmailSchema,
  attachRequestResponseSchema,
  attachRequestSchema,
  attachStateResponseSchema,
  defaultRemoteConfig,
  remoteConfigSchema,
} from "../src/index";

describe("attachEmailSchema (D6 layer 1 — normalization IS the boundary)", () => {
  it("T-CORE-S49: trims and lowercases before validating, and rejects non-emails, overlong input and empties", () => {
    expect(attachEmailSchema.parse("  Jogadora@Example.COM ")).toBe(
      "jogadora@example.com",
    );
    expect(attachEmailSchema.parse("simples@miolos.app")).toBe(
      "simples@miolos.app",
    );

    for (const bad of [
      "",
      "   ",
      "não-é-email",
      "sem-arroba.example.com",
      "a@",
      "@example.com",
      `${"a".repeat(250)}@example.com`,
    ]) {
      expect(
        attachEmailSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }

    expect(attachEmailSchema.safeParse(42).success).toBe(false);
    expect(attachEmailSchema.safeParse(null).success).toBe(false);
  });
});

describe("attachRequestSchema (D7 — the two consents)", () => {
  it("T-CORE-S51: recoveryConsent accepts only literal true, and reminderConsent is a required boolean with no default", () => {
    const base = { email: "jogadora@example.com" };

    expect(
      attachRequestSchema.parse({
        ...base,
        recoveryConsent: true,
        reminderConsent: false,
      }),
    ).toEqual({
      email: "jogadora@example.com",
      recoveryConsent: true,
      reminderConsent: false,
    });

    for (const recoveryConsent of [false, undefined, "true", 1]) {
      expect(
        attachRequestSchema.safeParse({
          ...base,
          recoveryConsent,
          reminderConsent: false,
        }).success,
        String(recoveryConsent),
      ).toBe(false);
    }

    expect(
      attachRequestSchema.safeParse({ ...base, recoveryConsent: true }).success,
    ).toBe(false);
    expect(
      attachRequestSchema.safeParse({
        ...base,
        recoveryConsent: true,
        reminderConsent: "false",
      }).success,
    ).toBe(false);
  });
});

describe("attachConfirmSchema (D2 — the token shape)", () => {
  it("T-CORE-S52: exactly the 43-char base64url shape; padded, longer, shorter and other-alphabet tokens are rejected", () => {
    const token = "A".repeat(43);
    expect(attachConfirmSchema.parse({ token })).toEqual({ token });
    expect(
      attachConfirmSchema.parse({ token: `${"a1_-".repeat(10)}xYZ` }).token,
    ).toHaveLength(43);

    for (const bad of [
      "A".repeat(42),
      "A".repeat(44),
      `${"A".repeat(42)}=`,
      `${"A".repeat(42)}+`,
      `${"A".repeat(42)}/`,
      "",
    ]) {
      expect(
        attachConfirmSchema.safeParse({ token: bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

describe("the response schemas are strict on both ends (ADR-0048's rule)", () => {
  it("T-CORE-S53: an extra key fails the parse on every one of the five", () => {
    const cases = [
      [attachRequestResponseSchema, { sent: true }],
      [attachConfirmResponseSchema, { merged: false }],
      [attachStateResponseSchema, { eligible: true }],
      [attachDismissResponseSchema, { dismissed: true }],
      [accountDeleteResponseSchema, { deleted: true }],
    ] as const;

    for (const [schema, valid] of cases) {
      expect(schema.safeParse(valid).success).toBe(true);
      expect(
        schema.safeParse({ ...valid, extra: 1 }).success,
        JSON.stringify(valid),
      ).toBe(false);
    }

    expect(attachDismissSchema.parse({})).toEqual({});
    expect(attachDismissSchema.safeParse({ anything: 1 }).success).toBe(false);

    expect(accountDeleteSchema.parse({ confirm: true })).toEqual({
      confirm: true,
    });
    expect(accountDeleteSchema.safeParse({ confirm: false }).success).toBe(
      false,
    );
    expect(accountDeleteSchema.safeParse({}).success).toBe(false);
  });
});

describe("remoteConfigSchema.attachStreakThreshold (D10, ADR-0003/ADR-0025)", () => {
  it("T-CORE-S54: defaults to 5, clamps 1..365 integers, and defaultRemoteConfig carries every key", () => {
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

    expect(remoteConfigSchema.parse({ attachStreakThreshold: 3 })).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 3,
      pushOptInStreakThreshold: 3,
    });

    for (const bad of [0, 366, 2.5, "5", null]) {
      expect(
        remoteConfigSchema.safeParse({ attachStreakThreshold: bad }).success,
        String(bad),
      ).toBe(false);
    }
  });
});
