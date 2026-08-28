import type { TelemetryEventProperties } from "@miolos/core";
import { afterEach, describe, expect, it, vi } from "vitest";

async function loadCapture() {
  vi.resetModules();
  return import("../src/telemetry/capture");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("captureEvent — the server-side PostHog capture (#33, ADR-0069)", () => {
  it("T-API-S155: without POSTHOG_KEY it logs ONCE, sends nothing and never throws — telemetry absent is a valid, loud state", async () => {
    vi.stubEnv("POSTHOG_KEY", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { captureEvent } = await loadCapture();

    await captureEvent({
      distinctId: "user-1",
      event: "notification_opt_in",
      properties: {},
    });
    await captureEvent({
      distinctId: "user-1",
      event: "login_linked",
      properties: { merged: false },
    });

    expect(fetchMock).not.toHaveBeenCalled();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("POSTHOG_KEY");
  });

  it("T-API-S156: a rejecting fetch and a hanging-then-aborted fetch both resolve silently — the helper never throws", async () => {
    vi.stubEnv("POSTHOG_KEY", "phc_test_key");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    const { captureEvent } = await loadCapture();

    await expect(
      captureEvent({
        distinctId: "user-1",
        event: "notification_opt_in",
        properties: {},
      }),
    ).resolves.toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const { captureEvent: captureAgain } = await loadCapture();
    const pending = captureAgain({
      distinctId: "user-1",
      event: "notification_opt_in",
      properties: {},
    });

    const init = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as RequestInit | undefined;
    (init?.signal as AbortSignal | undefined)?.dispatchEvent(
      new Event("abort"),
    );
    await expect(pending).resolves.toBeUndefined();
  });

  it("T-API-S157: the posted body is the capture contract — api_key, event, distinct_id, and the two anonymity properties", async () => {
    vi.stubEnv("POSTHOG_KEY", "phc_test_key");
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    const { captureEvent, POSTHOG_INGESTION_URL } = await loadCapture();

    await captureEvent({
      distinctId: "user-42",
      event: "puzzle_completed",
      properties: {
        game: "termo",
        date: "2026-08-21",
        elapsed_ms: 61_000,
        outcome: "lost",
        on_time: true,
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(POSTHOG_INGESTION_URL);
    expect(POSTHOG_INGESTION_URL).toBe("https://us.i.posthog.com/i/v0/e/");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual({
      api_key: "phc_test_key",
      event: "puzzle_completed",
      distinct_id: "user-42",
      properties: {
        game: "termo",
        date: "2026-08-21",
        elapsed_ms: 61_000,
        outcome: "lost",
        on_time: true,

        $process_person_profile: false,

        $geoip_disable: true,
      },
    });
  });

  it("T-API-S175: a property the event's schema does not declare DROPS the event — the strict schemas are parsed here, not only in packages/core's test", async () => {
    vi.stubEnv("POSTHOG_KEY", "phc_test_key");
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    const { captureEvent } = await loadCapture();

    await captureEvent({
      distinctId: "user-7",
      event: "login_linked",
      properties: {
        merged: true,
        email: "player@example.com",
      } as unknown as TelemetryEventProperties["login_linked"],
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await captureEvent({
      distinctId: "user-7",
      event: "login_linked",
      properties: { merged: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({
      api_key: "phc_test_key",
      event: "login_linked",
      distinct_id: "user-7",
      properties: {
        merged: true,
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
  });
});
