import { describe, expect, it } from "vitest";

import {
  notificationsDismissResponseSchema,
  notificationsDismissSchema,
  notificationsStateResponseSchema,
  pushNudgePayloadSchema,
  pushSubscribeResponseSchema,
  pushSubscribeSchema,
  pushUnsubscribeResponseSchema,
  pushUnsubscribeSchema,
  remoteConfigSchema,
} from "../src/index";

// The notification contracts (#145, ADR-0064; plan 061 §3). Strict on both
// ends throughout — the onboarding.ts register: every route parses before
// Response.json and the web client parses on arrival, so payload growth is
// a NEW endpoint and contract, never an appended field.

const ENDPOINT = "https://push.example.org/send/abc123";

describe("the notification schemas are strict on both ends (ADR-0048 decision 3)", () => {
  it("T-CORE-S100: unknown keys are rejected on all four schemas, vapidPublicKey is nullable, the subscribe keys are non-empty and capped, and the endpoint must be an https URL of bounded length", () => {
    // GET /notifications/state — eligible + the nullable public key.
    expect(
      notificationsStateResponseSchema.parse({
        eligible: true,
        vapidPublicKey: "BPublicKey",
      }),
    ).toEqual({ eligible: true, vapidPublicKey: "BPublicKey" });
    expect(
      notificationsStateResponseSchema.parse({
        eligible: false,
        vapidPublicKey: null,
      }),
    ).toEqual({ eligible: false, vapidPublicKey: null });
    expect(
      notificationsStateResponseSchema.safeParse({
        eligible: true,
        vapidPublicKey: null,
        threshold: 3, // the threshold never ships (ADR-0048's rule)
      }).success,
    ).toBe(false);
    expect(
      notificationsStateResponseSchema.safeParse({ eligible: true }).success,
    ).toBe(false);

    // POST /push/subscriptions — endpoint URL + the two non-empty keys.
    expect(
      pushSubscribeSchema.parse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k1", auth: "k2" },
      }),
    ).toEqual({ endpoint: ENDPOINT, keys: { p256dh: "k1", auth: "k2" } });
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: "not a url",
        keys: { p256dh: "k1", auth: "k2" },
      }).success,
    ).toBe(false);
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "", auth: "k2" },
      }).success,
    ).toBe(false);
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k1", auth: "" },
      }).success,
    ).toBe(false);
    // The scheme floor and the caps (#145 step-6 security 1/2, widened in
    // place): a browser push service is always https, and every stored row
    // is a URL #146's dispatcher will make a server-side request to — so
    // non-https schemes (metadata, loopback, file, javascript, data) and
    // over-long values are refused AT THE CONTRACT, on both verbs.
    for (const endpoint of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:5432/x",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain,hi",
      "ftp://x.example/a",
    ]) {
      expect(
        pushSubscribeSchema.safeParse({
          endpoint,
          keys: { p256dh: "k1", auth: "k2" },
        }).success,
        endpoint,
      ).toBe(false);
      expect(pushUnsubscribeSchema.safeParse({ endpoint }).success).toBe(false);
    }
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: `https://push.example.org/${"a".repeat(2100)}`,
        keys: { p256dh: "k1", auth: "k2" },
      }).success,
    ).toBe(false);
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k".repeat(129), auth: "k2" },
      }).success,
    ).toBe(false);
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k1", auth: "k".repeat(129) },
      }).success,
    ).toBe(false);
    // Real values fit with room: a p256dh is ~88 base64url chars, an auth
    // ~22 — the positive control that the caps refuse only the absurd.
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k".repeat(88), auth: "k".repeat(22) },
      }).success,
    ).toBe(true);

    // Strict at BOTH levels: an unknown key inside `keys` (the browser's
    // own toJSON may grow one) and one beside it both fail.
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k1", auth: "k2", extra: "x" },
      }).success,
    ).toBe(false);
    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k1", auth: "k2" },
        expirationTime: null,
      }).success,
    ).toBe(false);
    expect(pushSubscribeResponseSchema.parse({ subscribed: true })).toEqual({
      subscribed: true,
    });
    expect(
      pushSubscribeResponseSchema.safeParse({ subscribed: false }).success,
    ).toBe(false);

    // DELETE /push/subscriptions — the endpoint alone.
    expect(pushUnsubscribeSchema.parse({ endpoint: ENDPOINT })).toEqual({
      endpoint: ENDPOINT,
    });
    expect(pushUnsubscribeSchema.safeParse({ endpoint: "nope" }).success).toBe(
      false,
    );
    expect(
      pushUnsubscribeSchema.safeParse({ endpoint: ENDPOINT, all: true })
        .success,
    ).toBe(false);
    expect(pushUnsubscribeResponseSchema.parse({ removed: true })).toEqual({
      removed: true,
    });

    // POST /notifications/dismiss — the strict EMPTY object.
    expect(notificationsDismissSchema.parse({})).toEqual({});
    expect(notificationsDismissSchema.safeParse({ anything: 1 }).success).toBe(
      false,
    );
    expect(notificationsDismissSchema.safeParse(null).success).toBe(false);
    expect(
      notificationsDismissResponseSchema.parse({ dismissed: true }),
    ).toEqual({ dismissed: true });
    expect(
      notificationsDismissResponseSchema.safeParse({ dismissed: true, at: 1 })
        .success,
    ).toBe(false);
  });
});

describe("remoteConfigSchema.pushOptInStreakThreshold (#145, ADR-0064/ADR-0025)", () => {
  it("T-CORE-S101: defaults to 3, clamps 1..365 integers, and parses from a rows override", () => {
    expect(remoteConfigSchema.parse({}).pushOptInStreakThreshold).toBe(3);

    // A rows override parses (the getRemoteConfig merge shape: rows become
    // one object before this schema sees them).
    expect(
      remoteConfigSchema.parse({ pushOptInStreakThreshold: 7 })
        .pushOptInStreakThreshold,
    ).toBe(7);
    expect(
      remoteConfigSchema.parse({ pushOptInStreakThreshold: 1 })
        .pushOptInStreakThreshold,
    ).toBe(1);
    expect(
      remoteConfigSchema.parse({ pushOptInStreakThreshold: 365 })
        .pushOptInStreakThreshold,
    ).toBe(365);

    // Out-of-clamp / non-integer values fail the whole-config parse — the
    // accessor then falls back to defaults entirely (the existing
    // getRemoteConfig semantics, unchanged by this key).
    for (const bad of [0, 366, 2.5, "3", null]) {
      expect(
        remoteConfigSchema.safeParse({ pushOptInStreakThreshold: bad }).success,
        String(bad),
      ).toBe(false);
    }
  });
});

describe("pushNudgePayloadSchema (#146, ADR-0064 decision 6)", () => {
  it("T-CORE-S108: strict — exactly title and body, both non-empty; an unknown key, an empty string and a missing field are all rejected", () => {
    const payload = {
      title: "Miolos",
      body: "Sua sequência de 3 dias termina à meia-noite, no horário de Brasília. Jogue hoje para mantê-la.",
    };
    expect(pushNudgePayloadSchema.parse(payload)).toEqual(payload);
    // Strict: sw.js reads exactly these two keys — a third never ships.
    expect(
      pushNudgePayloadSchema.safeParse({ ...payload, url: "/binairo" }).success,
    ).toBe(false);
    // Non-empty on both: a blank notification is a composition bug, caught
    // BEFORE the send, not a fallback case for the worker.
    expect(
      pushNudgePayloadSchema.safeParse({ ...payload, title: "" }).success,
    ).toBe(false);
    expect(
      pushNudgePayloadSchema.safeParse({ ...payload, body: "" }).success,
    ).toBe(false);
    expect(pushNudgePayloadSchema.safeParse({ title: "Miolos" }).success).toBe(
      false,
    );
  });
});
