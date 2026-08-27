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

const ENDPOINT = "https://push.example.org/send/abc123";

describe("the notification schemas are strict on both ends (ADR-0048 decision 3)", () => {
  it("T-CORE-S100: unknown keys are rejected on all four schemas, vapidPublicKey is nullable, the subscribe keys are non-empty and capped, and the endpoint must be an https URL of bounded length", () => {
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
        threshold: 3,
      }).success,
    ).toBe(false);
    expect(
      notificationsStateResponseSchema.safeParse({ eligible: true }).success,
    ).toBe(false);

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

    expect(
      pushSubscribeSchema.safeParse({
        endpoint: ENDPOINT,
        keys: { p256dh: "k".repeat(88), auth: "k".repeat(22) },
      }).success,
    ).toBe(true);

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

    expect(
      pushNudgePayloadSchema.safeParse({ ...payload, url: "/binairo" }).success,
    ).toBe(false);

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
