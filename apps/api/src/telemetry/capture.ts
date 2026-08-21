import type { TelemetryEvent, TelemetryEventProperties } from "@miolos/core";
import { after } from "next/server";

/**
 * The server-side PostHog capture (#33, ADR-0069 decision 1): a hand-rolled
 * fetch to the capture API, zero dependencies, zero client SDK. A helper
 * this small structurally cannot autocapture, page-view, lazy-load remote
 * scripts or record a session — the five-event ceiling and the published
 * no-replay promise (messages.ts:839-840) hold by construction rather than
 * by an SDK kill-config a test would have to pin forever.
 *
 * The host is a constant, not env: the project's region is confirmed US
 * (issue #33, 2026-08-20) and a configurable host would be surface without
 * a consumer.
 */
export const POSTHOG_INGESTION_URL = "https://us.i.posthog.com/i/v0/e/";

/**
 * 3 s: a telemetry request that has not answered by then is abandoned. The
 * captures run post-response (inside `after()`), so this bounds background
 * work, never latency a player could see.
 */
const CAPTURE_TIMEOUT_MS = 3_000;

// Once-per-instance loud misconfiguration signal (the origin-guard.ts /
// streak-client.ts idiom): telemetry absent is a valid state — the helper
// no-ops — but it must be visible in the Vercel logs of the exact
// deployment where someone asks why the dashboard is empty (D8). T-API-S155
// pins "logs once, sends nothing, never throws".
let warnedMissingKey = false;

/**
 * Capture one of the five events for `distinctId` — the server `userId`
 * (ADR-0069 decision 5): no device id, no new cookie, nothing stored on the
 * client. `$process_person_profile: false` keeps the events anonymous-class
 * — PostHog builds no person profiles (verified against the capture API
 * docs at implement time).
 *
 * NEVER THROWS and never returns a failure: telemetry may not be able to
 * fail, delay or retry a route's work. A non-2xx answer is ignored — there
 * is nothing to retry at telemetry grade. The event parameter is typed off
 * the closed `TELEMETRY_EVENTS` union, so a sixth event is a compile error
 * (the runtime half is T-CORE-S110).
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
    await fetch(POSTHOG_INGESTION_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: input.event,
        distinct_id: input.distinctId,
        properties: {
          ...input.properties,
          $process_person_profile: false,
        },
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
  } catch {
    // Swallowed on purpose: a network failure or the 3 s abort above is a
    // lost telemetry event, never a route error. The message carries a
    // publishable token and no user data, so there is nothing to salvage.
  }
}

/**
 * The tail of the test-scope fallback chain below. In production it stays
 * permanently resolved — `after()` owns all scheduling there — so this is
 * consumed only by the seam-4 suites, which await it to make both positive
 * and negative capture assertions deterministic instead of sleeping.
 */
let settled: Promise<void> = Promise.resolve();

export function telemetrySettled(): Promise<void> {
  return settled;
}

/**
 * Run a telemetry task AFTER the response is sent (ADR-0069 decision 2's
 * "no telemetry work ever delays a response"), and make it unable to fail
 * the route either way.
 *
 * `after()` is stable in the installed Next 16.2.12, but it THROWS
 * (`"after was called outside a request scope"`, dist/server/after/after.js)
 * when no request work-store exists — which is exactly how every seam-4
 * suite in this repo invokes the handlers: a direct `POST(request)` call,
 * no Next server. The catch arm schedules the same task immediately,
 * fire-and-forget, chained onto `settled` so tests can await it. In a
 * deployed route the try arm always wins; the fallback is the test seam,
 * not a second production path.
 *
 * `safe` wraps the task in its own catch: a thrown derivation error (the
 * streak-broken read) must never surface anywhere — inside `after()` it
 * would only pollute the platform log with an unhandled rejection, and in
 * the fallback it would break the settled chain. T-API-S164 pins that a
 * throwing capture leaves the response untouched.
 */
export function runAfterResponse(task: () => Promise<void>): void {
  const safe = async (): Promise<void> => {
    try {
      await task();
    } catch (error) {
      console.error("telemetry: post-response task failed", error);
    }
  };
  try {
    after(safe);
  } catch {
    settled = settled.then(safe);
  }
}
