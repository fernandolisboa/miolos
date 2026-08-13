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

// The attach and account contracts (#21, ADR-0050; plan 031 §6). Strict on
// both ends throughout — the streak.ts register: every route parses before
// Response.json and every client parses on arrival, so payload growth is a
// NEW endpoint and contract, never an appended field.

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
      `${"a".repeat(250)}@example.com`, // over the 254 cap
    ]) {
      expect(
        attachEmailSchema.safeParse(bad).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
    // Non-strings never coerce.
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

    // Attaching IS the recovery consent (ADR-0012): a form without it is a
    // 400, never a default.
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

    // The reminder choice is stated EXPLICITLY by the client — absent is a
    // parse failure, not a default-off. (Default-off lives in the UI
    // checkbox and in the NULL column, T-WEB-S137 / T-API-S63.)
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
      `${"A".repeat(42)}=`, // padding is stripped at generation, never legal
      `${"A".repeat(42)}+`, // base64, not base64url
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

    // The dismiss REQUEST is the strict empty object: the client posts a
    // literal {} and any key is a 400 (plan 031 §6 — nothing smuggled).
    expect(attachDismissSchema.parse({})).toEqual({});
    expect(attachDismissSchema.safeParse({ anything: 1 }).success).toBe(false);

    // The delete request takes only the literal confirm (D13's deliberate
    // second factor against drive-by fetches).
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
  it("T-CORE-S54: defaults to 5, clamps 1..365 integers, and defaultRemoteConfig carries both keys", () => {
    expect(remoteConfigSchema.parse({})).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
    });
    expect(defaultRemoteConfig).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 5,
    });

    expect(remoteConfigSchema.parse({ attachStreakThreshold: 3 })).toEqual({
      bufferDepth: 7,
      attachStreakThreshold: 3,
    });

    // Out-of-clamp / non-integer values fail the whole-config parse — the
    // accessor then falls back to defaults entirely (the existing
    // getRemoteConfig semantics, unchanged by this key).
    for (const bad of [0, 366, 2.5, "5", null]) {
      expect(
        remoteConfigSchema.safeParse({ attachStreakThreshold: bad }).success,
        String(bad),
      ).toBe(false);
    }
  });
});
