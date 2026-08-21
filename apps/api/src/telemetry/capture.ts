import type { TelemetryEvent, TelemetryEventProperties } from "@miolos/core";
import { telemetryEventPropertiesSchemas } from "@miolos/core";
import { after } from "next/server";

/**
 * The server-side PostHog capture (#33, ADR-0069 decision 1): a hand-rolled
 * fetch to the capture API, zero dependencies, zero client SDK. A helper
 * this small structurally cannot autocapture, page-view, lazy-load remote
 * scripts or record a session — the five-event ceiling and the published
 * no-replay promise (`messages.privacy.collected.telemetry`, cited by
 * symbol because line numbers rot) hold by construction rather than by an
 * SDK kill-config a test would have to pin forever. The mechanical halves
 * of "stays disabled" are `T-LINT-S53` (the import ban) and `T-WEB-S322`
 * (the manifest and lockfile scan).
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
 *
 * THE PAYLOAD IS PARSED, NOT SPREAD (step-6 quality B1). The per-event
 * `z.strictObject` schemas are the boundary parse for the one boundary that
 * leaves our infrastructure, and the parse runs HERE rather than only in
 * `packages/core`'s own test: a call site that builds its properties from a
 * wider source — a spread, a DB row, an `as`-cast — would otherwise send
 * whatever it holds. A rejected payload lands in the swallow arm below, so
 * a smuggled key drops the event instead of riding to PostHog (T-API-S175).
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
          $process_person_profile: false,
        },
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    // Undici holds the connection until the body is read, cancelled or
    // collected; nothing here reads it, so release the socket rather than
    // leave one parked per event on a serverless instance (step-6
    // performance NB-5). Never awaited — cancelling is best-effort too.
    void response.body?.cancel().catch(() => {});
  } catch {
    // Swallowed on purpose: a rejected payload, a network failure or the
    // 3 s abort above is a lost telemetry event, never a route error. The
    // message carries a publishable token and no user data, so there is
    // nothing to salvage.
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
 * The ONE `after()` throw this module expects: a handler called with no
 * request work-store, which is how every seam suite here invokes them.
 * Matched on the message substring rather than on the error class because
 * Next exports no class for it — the literal is
 * "`after` was called outside a request scope. Read more: …"
 * (next@16.2.12, dist/server/after/after.js), read from the installed
 * package rather than recalled.
 */
const AFTER_OUTSIDE_REQUEST_SCOPE = /outside a request scope/;

/** Once-per-instance guard for the unexpected arm — see `runAfterResponse`. */
let warnedAfterUnavailable = false;

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
 * THE CATCH IS NARROWED TO THAT ONE MESSAGE (step-6 quality B2). "The try
 * arm always wins in production" is an assumption about a third-party
 * framework's throw conditions, and an unconditional catch would let a
 * Next bump, an unsupported runtime or an unforeseen call context turn the
 * test seam into a silent second production path. Anything that is NOT the
 * known outside-a-request-scope throw still takes the fallback — dropping
 * the event would be worse — but says so once per instance, the same
 * loud-degrade idiom as the missing-key branch above.
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
