import type { TelemetryEventProperties } from "@miolos/core";
import { users } from "@miolos/db";
import { createTestDb } from "@miolos/db/testing";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const USER_1 = "00000000-0000-4000-8000-000000000001";
const USER_7 = "00000000-0000-4000-8000-000000000007";
const USER_42 = "00000000-0000-4000-8000-000000000042";

let ctx: Awaited<ReturnType<typeof createTestDb>>;
let db: Awaited<ReturnType<typeof createTestDb>>["db"];

beforeAll(async () => {
  ctx = await createTestDb();
  db = ctx.db;
  await db
    .insert(users)
    .values([{ id: USER_1 }, { id: USER_7 }, { id: USER_42 }]);
}, 30_000);

afterAll(async () => {
  await ctx.close();
});

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
      db,
      distinctId: USER_1,
      event: "notification_opt_in",
      properties: {},
    });
    await captureEvent({
      db,
      distinctId: USER_1,
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
        db,
        distinctId: USER_1,
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
      db,
      distinctId: USER_1,
      event: "notification_opt_in",
      properties: {},
    });

    const hanging = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await vi.waitFor(() => {
      expect(hanging).toHaveBeenCalled();
    });
    const init = hanging.mock.calls[0]?.[1] as RequestInit | undefined;
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
      db,
      distinctId: USER_42,
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
      distinct_id: USER_42,
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
      db,
      distinctId: USER_7,
      event: "login_linked",
      properties: {
        merged: true,
        email: "player@example.com",
      } as unknown as TelemetryEventProperties["login_linked"],
    });

    expect(fetchMock).not.toHaveBeenCalled();

    await captureEvent({
      db,
      distinctId: USER_7,
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
      distinct_id: USER_7,
      properties: {
        merged: true,
        $process_person_profile: false,
        $geoip_disable: true,
      },
    });
  });
  it("T-API-S362: an opted-out account, a missing account and a failed read send nothing; the same event for a sending account goes out (ADR-0148)", async () => {
    vi.stubEnv("POSTHOG_KEY", "phc_test_key");
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    const { captureEvent } = await loadCapture();
    const optedOut = "00000000-0000-4000-8000-000000000099";
    await db
      .insert(users)
      .values({ id: optedOut, telemetryOptOutAt: new Date("2026-10-22") });
    const event = {
      db,
      event: "login_linked",
      properties: { merged: false },
    } as const;

    await captureEvent({ ...event, distinctId: optedOut });
    await captureEvent({
      ...event,
      distinctId: "00000000-0000-4000-8000-0000000000ff",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    await captureEvent({ ...event, distinctId: "not-a-uuid" });
    expect(fetchMock).not.toHaveBeenCalled();

    await captureEvent({ ...event, distinctId: USER_1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
