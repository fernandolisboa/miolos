import { describe, expect, it } from "vitest";

import {
  accountDetachEmailResponseSchema,
  accountDetachEmailSchema,
  accountStateResponseSchema,
  reminderConsentResponseSchema,
  reminderConsentSchema,
} from "../src/index";

function rejects(
  schema: { safeParse: (value: unknown) => { success: boolean } },
  values: unknown[],
): void {
  for (const value of values) {
    expect(schema.safeParse(value).success, JSON.stringify(value)).toBe(false);
  }
}

describe("accountStateResponseSchema", () => {
  it("T-CORE-S116: is strict, the email is nullable but never absent, and consent is a boolean", () => {
    expect(
      accountStateResponseSchema.parse({
        email: "jogadora@example.com",
        reminderConsent: true,
      }),
    ).toEqual({ email: "jogadora@example.com", reminderConsent: true });
    expect(
      accountStateResponseSchema.parse({ email: null, reminderConsent: false }),
    ).toEqual({ email: null, reminderConsent: false });

    rejects(accountStateResponseSchema, [
      { reminderConsent: false },
      { email: null },
      { email: null, reminderConsent: "yes" },
      { email: 1, reminderConsent: false },
      { email: null, reminderConsent: false, userId: "x" },
    ]);
  });
});

describe("the reminder-consent contract (ADR-0082 decision 2)", () => {
  it("T-CORE-S117: the request is a strict {granted: boolean}, the response a strict {reminderConsent: boolean}", () => {
    expect(reminderConsentSchema.parse({ granted: true })).toEqual({
      granted: true,
    });
    expect(reminderConsentSchema.parse({ granted: false })).toEqual({
      granted: false,
    });
    rejects(reminderConsentSchema, [
      {},
      { granted: "true" },
      { granted: 1 },
      { granted: true, email: "a@example.com" },
    ]);

    expect(
      reminderConsentResponseSchema.parse({ reminderConsent: false }),
    ).toEqual({ reminderConsent: false });
    rejects(reminderConsentResponseSchema, [
      {},
      { reminderConsent: "no" },
      { reminderConsent: true, email: null },
    ]);
  });
});

describe("the detach-email contract (ADR-0082 decision 3)", () => {
  it("T-CORE-S118: only the literal {confirm: true} passes, and the response is the literal {detached: true}", () => {
    expect(accountDetachEmailSchema.parse({ confirm: true })).toEqual({
      confirm: true,
    });
    rejects(accountDetachEmailSchema, [
      {},
      { confirm: false },
      { confirm: "true" },
      { confirm: true, email: "a@example.com" },
    ]);

    expect(accountDetachEmailResponseSchema.parse({ detached: true })).toEqual({
      detached: true,
    });
    rejects(accountDetachEmailResponseSchema, [
      { detached: false },
      {},
      { detached: true, extra: 1 },
    ]);
  });
});
