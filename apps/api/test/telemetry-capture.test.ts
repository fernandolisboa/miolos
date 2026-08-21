import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The hand-rolled capture helper (#33, ADR-0069 decision 1): a plain fetch
 * to PostHog's US ingestion endpoint, no SDK, no client identity, never a
 * throw into a route. Loaded per test via `vi.resetModules()` + dynamic
 * import because two pieces of module state are under test: the once-only
 * missing-key `console.error` guard (the D8 pin) and the fallback
 * `telemetrySettled()` chain.
 *
 * No `POSTHOG_KEY` rides any test environment — the no-key arm below is
 * also the standing proof that a test run sends nothing (D8's
 * never-send-in-tests requirement); the send-path tests stub the key AND
 * the global fetch, so nothing ever leaves the process either way.
 */

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
    // Once, not per call: the repo's loud-degrade idiom (streak-client.ts,
    // origin-guard.ts) without turning the platform log into a firehose.
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

    // The abort path: the stub honours the AbortSignal the helper passes,
    // so this is the 3 s timeout's rejection shape, not a mocked throw.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
            // Never resolves on its own — only the signal ends it.
          }),
      ),
    );
    const { captureEvent: captureAgain } = await loadCapture();
    const pending = captureAgain({
      distinctId: "user-1",
      event: "notification_opt_in",
      properties: {},
    });
    // Fire the abort by hand rather than waiting 3 s of wall clock.
    const init = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1] as RequestInit | undefined;
    (init?.signal as AbortSignal | undefined)?.dispatchEvent(
      new Event("abort"),
    );
    await expect(pending).resolves.toBeUndefined();
  });

  it("T-API-S157: the posted body is the capture contract — api_key, event, distinct_id, and properties carrying $process_person_profile: false", async () => {
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
        // Anonymous-class events (ADR-0069 decision 5): no person profiles
        // are built, so PostHog stores event rows and nothing person-shaped.
        $process_person_profile: false,
      },
    });
  });
});
