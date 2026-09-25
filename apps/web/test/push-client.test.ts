import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applicationServerKeyBytes,
  deletePushSubscription,
  dismissPushPrompt,
  fetchNotificationsState,
  postPushSubscription,
} from "../src/push/push-client";
import { webCodeOf } from "./ts-source";

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

    const [subscribeUrl, subscribeInit] = fetchMock.mock
      .calls[0] as unknown as [string, RequestInit];
    expect(subscribeUrl).toBe("https://api.example.test/push/subscriptions");
    expect(subscribeInit.method).toBe("POST");
    expect(subscribeInit.credentials).toBe("include");
    expect(subscribeInit.headers).toEqual({
      "Content-Type": "application/json",
    });

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

    expect(typeof dismissInit.body).toBe("string");
    expect(JSON.parse(dismissInit.body as string)).toEqual({});
  });

  it("applicationServerKeyBytes decodes base64url, unpadded included, to the exact bytes", () => {
    expect([...applicationServerKeyBytes("AQID")]).toEqual([1, 2, 3]);
    expect([...applicationServerKeyBytes("_-8")]).toEqual([255, 239]);
  });
});

describe("turning push off asks the server to forget this endpoint (T-WEB-S397)", () => {
  it("deletePushSubscription sends the credentialed JSON DELETE the route parses, through the one request path", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { removed: true })),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await deletePushSubscription(ENDPOINT)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.example.test/push/subscriptions");
    expect(init).toEqual({
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: ENDPOINT }),
    });
    expect(webCodeOf("src/api/client.ts").match(/fetch\(/g)).toHaveLength(2);
  });

  it("a non-ok status, a network failure and a missing URL all answer false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(500, { error: "internal" }))),
    );
    expect(await deletePushSubscription(ENDPOINT)).toBe(false);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    expect(await deletePushSubscription(ENDPOINT)).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await deletePushSubscription(ENDPOINT)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
