import type { Game } from "@miolos/core";

/**
 * The client half of the telemetry relay (#33, ADR-0069 decision 2) — the
 * `streak-client.ts` shape: fetch only, no React, so it is testable without
 * rendering.
 *
 * IT POSTS ONE EVENT AND CAN POST NO OTHER. `puzzle_started` is the single
 * event with no server fact behind it (no completion row exists before the
 * grid closes), so it is the only one that has to travel from a browser; the
 * other four fire inside their authoritative routes, where no client can
 * forge them. The relay's contract in packages/core is a single event
 * literal, so this module's body is also the whole client-originated surface
 * of the telemetry system.
 *
 * NOTHING HERE HOLDS AN IDENTITY. The request carries the session cookie and
 * the server resolves `distinct_id` from it (ADR-0069 decision 5): no PostHog
 * device id, no new cookie, no `localStorage` key — which is what keeps
 * `/privacidade`'s published inventory true without a copy change.
 *
 * FIRE-AND-FORGET, ALWAYS. Every call returns `void` synchronously; the
 * promise is never handed to a caller and every failure is swallowed. A play
 * screen's mount may not await, retry or fail on telemetry, and `keepalive`
 * lets the request survive the navigation that a fast first move causes.
 *
 * BEHIND THE FREE-PLAY WALL: `src/telemetry` is banned by name from
 * `apps/web/src/free-play` and `app/modo-livre`, in both the static group and
 * the dynamic-import regex (eslint.config.mjs, ADR-0046, ADR-0069 decision 4)
 * — free play fires no events at all, and the wall is what makes that
 * mechanical rather than a promise. T-LINT-S52 probes both arms.
 */

/**
 * THE SESSION GATE, and the reason this module buffers at all. `POST
 * /telemetry` answers a cookieless request with a 204 DROP (no error, nothing
 * captured), and on a cold first visit the play screen's mount effect runs
 * while `POST /session` is still in flight — so an ungated fire would lose
 * the `puzzle_started` of every first-ever visit, which is precisely the
 * population the event exists to measure.
 *
 * `bootstrap.ts` flips this once `ensureSession()` SETTLES, success or
 * failure alike: a failed mint means the relay will drop the event, and
 * buffering it forever would only grow a list nothing drains.
 */
let sessionReady = false;

/** Events called for before the mint settled, in call order. Drained once. */
let buffered: { readonly game: Game; readonly date: string }[] = [];

/**
 * The per-`(game, date)` once-guard. A play screen can mount several times in
 * one page load — React StrictMode's double effect, a visibility remount, a
 * client-side navigation back to the same board — and each is the same
 * attempt at the same puzzle, not a new one. The key is the pair because the
 * archive makes the date a real dimension: yesterday's Sudoku and today's are
 * two starts.
 *
 * Module-level, so it survives every remount for the page's lifetime, and
 * deliberately never cleared: a reload is a new page load and a genuinely new
 * measurement.
 */
const fired = new Set<string>();

/**
 * "The anonymous session mint has settled." Called by `session/bootstrap.ts`
 * and by nobody else.
 *
 * Idempotent and drain-once: a second call finds an empty buffer.
 */
export function markSessionReady(): void {
  sessionReady = true;
  const pending = buffered;
  buffered = [];
  for (const event of pending) {
    send(event.game, event.date);
  }
}

/**
 * Report that a fresh attempt at `game` on `date` has begun — the daily and
 * the archive alike (ADR-0069 decision 4; the server decides `archive`
 * against its own São Paulo today, so this call asserts nothing about which
 * it is).
 *
 * NEVER CALLED FOR FREE PLAY: free play never mounts the play lifecycle, and
 * the wall above keeps that structural.
 */
export function postPuzzleStarted(game: Game, date: string): void {
  const key = `${game}:${date}`;
  if (fired.has(key)) {
    return;
  }
  fired.add(key);
  if (!sessionReady) {
    buffered.push({ game, date });
    return;
  }
  send(game, date);
}

/**
 * The request. `void` on purpose and `.catch` on purpose: an unhandled
 * rejection from a fire-and-forget fetch is noise in a browser and a failure
 * in a test run, and there is nothing to report at telemetry grade.
 *
 * `keepalive: true` so a player who makes their first move and navigates
 * within the same tick does not cancel their own start event. The JSON
 * content type forces a CORS preflight (the body-less session POST avoids
 * one, this cannot) — accepted: nothing waits on this round trip.
 */
let warnedMissingApiUrl = false;

function send(game: Game, date: string): void {
  // Loud, not silent (the `streak-client.ts` / `bootstrap.ts` guard): without
  // the var the fetch would hit the relative URL "undefined/telemetry" and
  // the catch below would swallow the misconfiguration forever.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    // ONCE per module, not once per event — the same guard the server's
    // `warnedMissingKey` uses, which this comment already cited as its
    // model while logging per call (step-6 correctness N8). Bounded either
    // way (a page load has few distinct starts), but the asymmetry was the
    // kind a reader trusts the comment over.
    if (!warnedMissingApiUrl) {
      warnedMissingApiUrl = true;
      console.error(
        "NEXT_PUBLIC_API_URL is unset: puzzle_started not reported, telemetry stays blind",
      );
    }
    return;
  }
  try {
    void fetch(`${apiUrl}/telemetry`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      // The relay contract's exact shape (`telemetryRelayRequestSchema`):
      // the event literal and the two properties the client legitimately
      // knows. `archive` is absent by design — the server derives it.
      body: JSON.stringify({
        event: "puzzle_started",
        properties: { game, date },
      }),
      keepalive: true,
    }).catch(() => {
      // Offline, blocked by a content blocker, or refused: a lost telemetry
      // event, never a broken board.
    });
  } catch {
    // A `fetch` that throws SYNCHRONOUSLY — a stubbed global in a test, a
    // hostile extension replacing it — must not take the mount effect with
    // it. The rejecting case is the `.catch` above; this is the other one.
  }
}
