import type { TelemetryEvent, TelemetryEventProperties } from "@miolos/core";
import { telemetryEventPropertiesSchemas } from "@miolos/core";
import { after } from "next/server";

/**
 * The server-side PostHog capture: a hand-rolled fetch, zero SDK — see
 * ADR-0069 decision 1 for why (the five-event ceiling and the no-replay
 * promise hold by construction, not by an SDK kill-config).
 */
export const POSTHOG_INGESTION_URL = "https://us.i.posthog.com/i/v0/e/";

// Captures run post-response (inside `after()`), so this bounds background
// work only, never latency a player could see.
const CAPTURE_TIMEOUT_MS = 3_000;

// Once-per-instance loud signal: telemetry absence is valid, but must not
// be silent in the deploy logs. If this fires with POSTHOG_KEY set on the
// project, the running deployment predates the key — see the
// turbo-ignore trap documented in src/cron/auth.ts.
let warnedMissingKey = false;

/**
 * Capture one of the five events for `distinctId` — the server `userId`,
 * never a device id or a client-stored cookie. Never throws and never
 * surfaces a failure: a non-2xx or a network error is swallowed, since
 * telemetry may not delay, fail or retry a route's work.
 *
 * The payload is parsed against the event's `z.strictObject` schema HERE,
 * not only in `packages/core`'s own test — a call site that builds its
 * properties from a wider source (a spread, a DB row) would otherwise send
 * whatever it holds. A rejected parse drops the event instead of shipping
 * the smuggled key to PostHog.
 */
export async function captureEvent<E extends TelemetryEvent>(input: {
  distinctId: string;
  event: E;
  properties: TelemetryEventProperties[E];
}): Promise<void> {
  const key = process.env.POSTHOG_KEY;
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.error(
        "POSTHOG_KEY is unset: telemetry capture disabled, no events are sent (ADR-0069)",
      );
    }
    return;
  }
  try {
    // Throws on an extra key (every schema is strict) — deliberately
    // inside the try, so a smuggled property is a dropped event.
    const properties = telemetryEventPropertiesSchemas[input.event].parse(
      input.properties,
    );
    const response = await fetch(POSTHOG_INGESTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: input.event,
        distinct_id: input.distinctId,
        properties: {
          ...properties,
          // Anonymous-class events only — no person profiles (ADR-0069 d5).
          $process_person_profile: false,
          // Server->server from a Vercel function, so the IP PostHog sees
          // is the function's egress, not the player's — without this it
          // would geo-tag every event with a datacentre instead.
          $geoip_disable: true,
        },
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    // Undici holds the connection until the body is read, cancelled or
    // collected; release the socket rather than leak one per event.
    void response.body?.cancel().catch(() => {});
  } catch {
    // A rejected payload, a network failure or the timeout above is a lost
    // telemetry event, never a route error.
  }
}

// Stays permanently resolved in production (`after()` owns scheduling
// there); the integration suites await it to make capture assertions
// deterministic instead of sleeping.
let settled: Promise<void> = Promise.resolve();

export function telemetrySettled(): Promise<void> {
  return settled;
}

// Matched on message substring, not error class — Next exports no class
// for this throw (next@16.2.12, dist/server/after/after.js).
const AFTER_OUTSIDE_REQUEST_SCOPE = /outside a request scope/;

let warnedAfterUnavailable = false;

/**
 * Run a telemetry task after the response is sent, and make it unable to
 * fail the route either way. `after()` throws when no request work-store
 * exists, which is how every integration suite here invokes a handler
 * directly (no Next server) — the catch arm runs the task immediately
 * instead, chained onto `settled` so tests can await it.
 *
 * The catch is narrowed to that one known throw message rather than
 * unconditional: a Next bump or an unsupported runtime hitting a
 * *different* throw should not silently fall back to a second, un-tracked
 * production path — it still falls back (dropping the event is worse) but
 * logs once that `after()` was unavailable.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const safe = async (): Promise<void> => {
    try {
      await task();
    } catch (error) {
      // The message, not the error object: a drizzle/neon failure can carry
      // the failing query with its bound params (userId included).
      console.error(
        "telemetry: post-response task failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  };
  try {
    after(safe);
  } catch (error) {
    if (!AFTER_OUTSIDE_REQUEST_SCOPE.test(String(error))) {
      if (!warnedAfterUnavailable) {
        warnedAfterUnavailable = true;
        console.error(
          "telemetry: after() unavailable, the task ran un-tracked (ADR-0069)",
          error,
        );
      }
    }
    settled = settled.then(safe);
  }
}
