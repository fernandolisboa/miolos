import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applicationServerKeyBytes,
  dismissPushPrompt,
  fetchNotificationsState,
  postPushSubscription,
} from "../src/push/push-client";

// The fetch-and-parse half of the notification endpoints (#145, ADR-0064;
// plan 058 §5), tested without rendering — the streak-client suite's
// conventions. This suite deliberately keeps the unset-env case (the
// bootstrap.ts guard parity), which every RENDERING suite avoids by
// stubbing the pair.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const ENDPOINT = "https://push.example.org/send/abc";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("push-client (T-WEB-S263)", () => {
  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset — all three calls", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchNotificationsState()).toBeUndefined();
    expect(
      await postPushSubscription({
        endpoint: ENDPOINT,
        keys: { p256dh: "p", auth: "a" },
      }),
    ).toBe(false);
    expect(await dismissPushPrompt()).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(3);
  });

  it("parses a valid state body against the strict contract, credentialed, as a CORS simple request", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse(200, { eligible: true, vapidPublicKey: "BKey" }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchNotificationsState()).toEqual({
      eligible: true,
      vapidPublicKey: "BKey",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example.test/notifications/state");
    expect(init.credentials).toBe("include");
    // No content type on the GET: a simple request never preflights.
    expect(init.headers).toBeUndefined();
  });

  it("every failure resolves undefined — malformed 200 bodies, non-200, network — never a throw into the UI", async () => {
    const malformed: readonly unknown[] = [
      {},
      { eligible: true },
      { eligible: "true", vapidPublicKey: null },
      { eligible: true, vapidPublicKey: null, threshold: 3 },
      [],
      "eligible",
    ];
    for (const body of malformed) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(200, body))),
      );
      expect(await fetchNotificationsState(), JSON.stringify(body)) //
        .toBeUndefined();
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(500, { error: "internal" }))),
    );
    expect(await fetchNotificationsState()).toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    expect(await fetchNotificationsState()).toBeUndefined();
    expect(
      await postPushSubscription({
        endpoint: ENDPOINT,
        keys: { p256dh: "p", auth: "a" },
      }),
    ).toBe(false);
    expect(await dismissPushPrompt()).toBe(false);
  });

  it("both writes send the explicit JSON content type — the preflight trigger that makes the WEB_ORIGIN grant load-bearing — and their exact bodies", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { subscribed: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await postPushSubscription({
        endpoint: ENDPOINT,
        keys: { p256dh: "p", auth: "a" },
      }),
    ).toBe(true);
    expect(await dismissPushPrompt()).toBe(true);

    // The double cast is the checker's price on an untyped mock's calls
    // array (`[] | undefined`), not a boundary crossing — the values are
    // asserted exactly below.
    const [subscribeUrl, subscribeInit] = fetchMock.mock
      .calls[0] as unknown as [string, RequestInit];
    expect(subscribeUrl).toBe("https://api.example.test/push/subscriptions");
    expect(subscribeInit.method).toBe("POST");
    expect(subscribeInit.credentials).toBe("include");
    expect(subscribeInit.headers).toEqual({
      "Content-Type": "application/json",
    });
    // The client builds the body with JSON.stringify, so it is a string —
    // asserted first, which also satisfies no-base-to-string.
    expect(typeof subscribeInit.body).toBe("string");
    expect(JSON.parse(subscribeInit.body as string)).toEqual({
      endpoint: ENDPOINT,
      keys: { p256dh: "p", auth: "a" },
    });

    const [dismissUrl, dismissInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(dismissUrl).toBe("https://api.example.test/notifications/dismiss");
    expect(dismissInit.method).toBe("POST");
    expect(dismissInit.headers).toEqual({
      "Content-Type": "application/json",
    });
    // The strict empty body: any key would be a 400 server-side.
    expect(typeof dismissInit.body).toBe("string");
    expect(JSON.parse(dismissInit.body as string)).toEqual({});
  });

  it("applicationServerKeyBytes decodes base64url, unpadded included, to the exact bytes", () => {
    // "AQID" is base64url for [1, 2, 3]; "_-8" exercises the url alphabet
    // ([255, 239]) and a length needing padding.
    expect([...applicationServerKeyBytes("AQID")]).toEqual([1, 2, 3]);
    expect([...applicationServerKeyBytes("_-8")]).toEqual([255, 239]);
  });
});
