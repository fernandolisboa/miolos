import { describe, expect, it } from "vitest";

import {
  accountDetachEmailResponseSchema,
  accountDetachEmailSchema,
  accountStateResponseSchema,
  gameSettingsPayloadSchema,
  gameSettingsStateResponseSchema,
  gameSettingsWriteResponseSchema,
  gameSettingsWriteSchema,
  reminderConsentResponseSchema,
  reminderConsentSchema,
  telemetryChoiceSchema,
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

describe("the reminder-consent contract (ADR-0082 decision 3)", () => {
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

describe("the detach-email contract (ADR-0082 decision 4)", () => {
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

describe("the telemetry choice contract (#37, ADR-0148)", () => {
  it("T-CORE-S210: request and response are one strict {sending: boolean}", () => {
    expect(telemetryChoiceSchema.parse({ sending: false })).toEqual({
      sending: false,
    });
    expect(telemetryChoiceSchema.parse({ sending: true })).toEqual({
      sending: true,
    });
    rejects(telemetryChoiceSchema, [
      {},
      { sending: "false" },
      { sending: 0 },
      { sending: true, userId: "u" },
    ]);
  });
});

describe("the game-settings sync contract (#317, ADR-0149)", () => {
  const settings = {
    showClock: true,
    mistakeLimit: false,
    games: {
      binairo: { showErrors: false, firstValue: 1 },
      nonogram: { lineCross: "always" },
    },
  };

  it("T-CORE-S211: the payload is a bounded object of three levels whose leaves are booleans, finite numbers or short strings", () => {
    expect(gameSettingsPayloadSchema.parse(settings)).toEqual(settings);
    expect(gameSettingsPayloadSchema.parse({})).toEqual({});
    const hostile = gameSettingsPayloadSchema.parse(
      JSON.parse('{"__proto__": {"polluted": true}, "showClock": true}'),
    );
    expect(Object.keys(hostile)).toEqual(["showClock"]);
    expect(Object.getPrototypeOf(hostile)).toBe(Object.prototype);
    rejects(gameSettingsPayloadSchema, [
      null,
      [],
      "showClock",
      { showClock: null },
      { showClock: [true] },
      { showClock: Number.POSITIVE_INFINITY },
      { lineCross: "x".repeat(33) },
      { a: { b: { c: { d: true } } } },
      { "1game": true },
      { "show-clock": true },
      { ["k".repeat(33)]: true },
      Object.fromEntries(
        Array.from({ length: 41 }, (_, index) => [`k${String(index)}`, true]),
      ),
    ]);
  });

  it("T-CORE-S212: a payload over 4 KB is refused even when every level is within its key count", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 40 }, (_, index) => [
        `g${String(index)}`,
        Object.fromEntries(
          Array.from({ length: 10 }, (_, inner) => [
            `k${String(inner)}`,
            "x".repeat(10),
          ]),
        ),
      ]),
    );
    rejects(gameSettingsPayloadSchema, [wide]);
  });

  it("T-CORE-S213: the read is a strict {settings} that may be null, the write a strict {settings} answered by the literal {saved: true}", () => {
    expect(gameSettingsStateResponseSchema.parse({ settings: null })).toEqual({
      settings: null,
    });
    expect(gameSettingsStateResponseSchema.parse({ settings })).toEqual({
      settings,
    });
    rejects(gameSettingsStateResponseSchema, [{}, { settings, userId: "u" }]);
    expect(gameSettingsWriteSchema.parse({ settings })).toEqual({ settings });
    rejects(gameSettingsWriteSchema, [
      {},
      { settings: null },
      { settings, extra: 1 },
    ]);
    expect(gameSettingsWriteResponseSchema.parse({ saved: true })).toEqual({
      saved: true,
    });
    rejects(gameSettingsWriteResponseSchema, [{ saved: false }, {}]);
  });
});
