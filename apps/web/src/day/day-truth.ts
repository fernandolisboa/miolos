"use client";

import type { DayResponse } from "@miolos/core";
import { useSyncExternalStore } from "react";

import { fetchDayTruth } from "./day-client";

/**
 * The server's answer about TODAY, held once for the whole page (#83,
 * ADR-0060 decision 5).
 *
 * WHY A MODULE-LEVEL STORE AND NOT `useStreak`'s MOUNT EFFECT: `useDayState`
 * is called FIVE TIMES on one hub render — one `HubProgress` plus four
 * `HubCardAction`s — and a per-hook mount effect would fire five credentialed
 * GETs per hub view. The store makes it one. It is also the idiom
 * `play/use-record-snapshot.ts` already establishes for a module-level source
 * with N consumers. A React context was rejected: the hub's client fragments
 * are separate islands inside a server component, and a provider would
 * restructure `app/page.tsx` to buy the same thing.
 *
 * `useDayTruth()` TAKES NO ARGUMENT, and that is load-bearing rather than
 * terse. The moment the hook takes a `date` and filters internally, this one
 * module-level slot is serving a KEYED PROJECTION — ADR-0056's exact defect
 * one level up: N consumers with different keys evicting each other on every
 * `getSnapshot`, a fresh object per read, `Maximum update depth exceeded`
 * (measured there at 17 live consumers against a 16-entry cache, plain and
 * in StrictMode). There is exactly one "today" payload, every consumer reads
 * the same value, so there is nothing to key and nothing to evict. The date
 * filter lives in `play/day-state.ts`, where the rendered day is already a
 * parameter. Do not add one here.
 *
 * WHEN IT FETCHES:
 *
 * - LISTENER COUNT 0 -> 1, at effect time and never during render. Not "the
 *   first subscriber": a client-side navigation `/sudoku/concluido -> /`
 *   drops every subscriber and re-adds five, and a store that fetched once
 *   per page load would answer the most frequent way a player looks at the
 *   hub with the payload from the session's first mount.
 * - `visibilitychange` -> visible, `focus`, and `online` — the last being
 *   the offline -> online recovery path the client's fallback promises.
 * - A 60 s POLL, and ONLY while both of these hold: at least one listener is
 *   subscribed, and the document is visible. ADR-0060 decision 5 shipped
 *   this store with NO interval and named its cost — an already-open,
 *   already-focused tab (a second monitor sitting on the hub) never updates
 *   on its own — with a complaint as the trigger for revisiting. The
 *   complaint fired: Fernando asked, answering PR #135's veto decision 4,
 *   and #143 amended the clause (annotation (a)). The timer is torn down
 *   while hidden — `visibilitychange` -> visible already refetches on
 *   re-show, so a hidden tab owes the server nothing — and at zero
 *   listeners, where cleanup clears it; each tick goes through `refresh()`,
 *   so the in-flight guard below means a slow answer is never stacked on.
 * - A ONE-SHOT NUDGE WHEN A COMPLETION SETTLES `recorded` (#64, ADR-0070),
 *   fired by the conclusion through `refreshDayTruth()`. Honest independent
 *   of #64 — the server's day truth genuinely just changed — and it exists
 *   because the motif name is the payoff moment's whole point, and waiting
 *   up to 60 s for the poll to reveal it is not a payoff. It is EVENT-DRIVEN
 *   AND ONE-SHOT, not a second interval, so the clause above stays exact.
 * - NOTHING ELSE.
 *
 * CLEANUP DROPS THE LISTENERS AND RETAINS THE PAYLOAD. The last unsubscribe
 * removes the three window/document handlers and leaves the cached value in
 * place; only the date precondition in `day-state.ts` retires it. Clearing it
 * would flip the snapshot to `undefined` and demote every cross-device tile
 * to pending for the length of a fetch, on every navigation.
 *
 * THE RETENTION IS ARGUED AGAINST NAVIGATION, AND THERE IS A SECOND CASE:
 * IDENTITY. `POST /attach/confirm` REPLACES this device's session with the
 * linked account's (`app/vincular/attach-confirm.tsx`) and its success
 * screen returns to the hub with a Next `<Link>` — a CLIENT-SIDE navigation,
 * so this module is never re-evaluated and the pre-swap payload is what
 * `getSnapshot` answers on the first paint after linking. The store has no
 * notion of "the session changed". This is NOT a cross-person leak, and the
 * argument had to be REBUILT at #64 rather than left standing: it used to
 * rest partly on "the payload carries only four claims and a date, no puzzle
 * content", and that clause is now false — a completed Nonogram claim
 * carries `motifName`, which IS curated daily content (ADR-0070). What
 * actually holds the residual safe never depended on that clause:
 *
 * - ADR-0009 merges the two identities into ONE HUMAN, so a stale pre-swap
 *   payload is that same person's own day, not a stranger's;
 * - the DATE PRECONDITION in `day-state.ts` bounds it to the same day, and
 *   the motif name is today's, published to a person who has today's row;
 * - the 0 -> 1 `refresh()` the hub's remount fires corrects it within ONE
 *   ROUND TRIP.
 *
 * The one thing #64 adds is that a stale claim could name a motif the
 * post-swap identity had also completed — the same day, the same published
 * puzzle, the same name. It is recorded here as a named residual rather than
 * fixed with a `resetDayTruth()` export because the correction is already
 * one round trip away and an extra cross-module hook into the attach flow
 * would buy a frame.
 *
 * NO `localStorage` CACHE of the payload (ADR-0048 decision 4's argument): a
 * stale server answer presented as current is wrong in both directions, and
 * the local reader is already the honest offline answer.
 */

/** The last payload the server answered with, or `undefined` if none has. */
let payload: DayResponse | undefined;

const listeners = new Set<() => void>();

/** One fetch at a time: the dedupe every trigger above relies on. */
let inFlight = false;

/**
 * `getSnapshot` must return a referentially stable value or
 * `useSyncExternalStore` loops forever. This one returns a module variable
 * that only ever changes when the payload really changed, so stability is
 * structural rather than cached.
 */
function getSnapshot(): DayResponse | undefined {
  return payload;
}

/**
 * The SSR snapshot is `undefined` — no server truth at render time — so the
 * server markup and the pre-hydration client render agree byte-for-byte and
 * NO FETCH HAPPENS AT RENDER. The hub's first-paint contract (T-WEB-S17 /
 * T-WEB-S127) is untouched.
 */
function getServerSnapshot(): DayResponse | undefined {
  return undefined;
}

/**
 * Field for field: date plus the four claims — each a status AND, since
 * #141, its optional `elapsedMs`, AND, since #142, its optional `hintsUsed`,
 * AND, since #64, the Nonogram's optional `motifName`. Comparing the status
 * alone would swallow a payload whose only change is a duration, a hint
 * count or a motif NAME, and the stale value would stand for the session.
 *
 * `motifName` is the case where that is not hypothetical: a first read that
 * raced a killed or malformed daily row answers `completed` with no name,
 * and the corrected payload one poll later differs in NOTHING ELSE. Without
 * this line the caption would never appear for that user today.
 */
function sameGame(
  previous: DayResponse["games"]["termo"],
  next: DayResponse["games"]["termo"],
): boolean {
  return (
    previous.status === next.status &&
    previous.elapsedMs === next.elapsedMs &&
    previous.hintsUsed === next.hintsUsed &&
    previous.motifName === next.motifName
  );
}

function samePayload(previous: DayResponse, next: DayResponse): boolean {
  return (
    previous.date === next.date &&
    sameGame(previous.games.termo, next.games.termo) &&
    sameGame(previous.games.sudoku, next.games.sudoku) &&
    sameGame(previous.games.nonogram, next.games.nonogram) &&
    sameGame(previous.games.binairo, next.games.binairo)
  );
}

/**
 * One fetch, deduped. A refetch that changes nothing keeps the previous
 * object identity, so it re-renders nothing — `sameDayState`'s discipline,
 * one level up.
 *
 * A FAILED FETCH RETAINS whatever was already held rather than clearing it:
 * `fetchDayTruth` answers `undefined` for a network blip and for a real
 * absence alike, and demoting every cross-device tile on a transient failure
 * is the visible loss cleanup is written to avoid. The date precondition
 * still bounds how long a retained payload can be believed.
 *
 * THE RESET IS IN `finally`, NOT IN THE `then`, and that is the difference
 * between a local guarantee and a borrowed one. `fetchDayTruth` is total by
 * construction today — one `try`/`catch` around the fetch, the `json()` and
 * the `safeParse` — but that is a property of a SIBLING MODULE's body, not
 * of a signature. With the reset inside the `then`, one escaping rejection
 * leaves `inFlight === true` for the lifetime of the page: every later
 * trigger, `online` recovery included, is swallowed by the guard and there
 * is no way back short of a reload. In `finally` the guard's correctness is
 * local and stays local. `T-WEB-S246` stubs a rejecting `fetchDayTruth` and
 * asserts the next trigger still fetches.
 *
 * The `catch` beside it is not decoration: `finally` RE-THROWS, so without it
 * the same escaping rejection becomes an unhandled rejection — noise in a
 * test run, and a `unhandledrejection` handler's problem in a browser. It
 * SWALLOWS deliberately, because the client's contract is already "every
 * failure answers `undefined`" and there is nothing here to report that
 * `day-client.ts` has not already decided not to report (ADR-0060 decision
 * 4's silent-degradation path).
 */
function refresh(): void {
  if (inFlight) {
    return;
  }
  inFlight = true;
  void fetchDayTruth()
    .then((next) => {
      if (next === undefined) {
        return;
      }
      if (payload !== undefined && samePayload(payload, next)) {
        return;
      }
      payload = next;
      for (const listener of listeners) {
        listener();
      }
    })
    .catch(() => {
      // Unreachable through the shipped client, and swallowed on purpose —
      // see the header. The retained payload stands; the guard is released
      // by the `finally` below either way.
    })
    .finally(() => {
      inFlight = false;
    });
}

/**
 * 60 s: modest against the most-hit route in the app — the payload can
 * change at most four times a day, so anything tighter buys staleness
 * measured in seconds at a multiple of the request count — and short enough
 * that the second-monitor case reads a completion within a minute
 * (ADR-0060 decision 5, annotation (a) at #143).
 */
const POLL_INTERVAL_MS = 60_000;

let pollTimer: ReturnType<typeof setInterval> | undefined;

/** Idempotent: a running timer is kept, never doubled. */
function startPoll(): void {
  if (pollTimer !== undefined) {
    return;
  }
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
}

function stopPoll(): void {
  if (pollTimer === undefined) {
    return;
  }
  clearInterval(pollTimer);
  pollTimer = undefined;
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") {
    startPoll();
    refresh();
  } else {
    // No timer while hidden: the visible branch above already refetches on
    // re-show, so ticks in a hidden tab would be pure request volume.
    stopPoll();
  }
}

function subscribe(onStoreChange: () => void): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(onStoreChange);
  if (wasEmpty) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    if (document.visibilityState === "visible") {
      startPoll();
    }
    refresh();
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      stopPoll();
      // The payload is RETAINED on purpose — see the header.
    }
  };
}

/** The server's day truth, live. `undefined` until (or unless) one lands. */
export function useDayTruth(): DayResponse | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Ask the store to refetch, once, now (#64, ADR-0070). Fire-and-forget: the
 * store notifies its subscribers if anything changed and does nothing if not.
 *
 * WHAT ITS GUARD ACTUALLY IS, stated exactly rather than assumed: `refresh()`
 * is guarded by `inFlight` and by NOTHING ELSE. The subscriber and visibility
 * conditions live on `startPoll`/`stopPoll`/`subscribe`, and
 * `window.addEventListener("focus", refresh)` calls it unconditionally too.
 * So this CAN fire a credentialed `GET /day` with no listener subscribed.
 * Accepted explicitly, and bounded: at most four completions per user per
 * day, and in the common case it is a no-op anyway, because the caller's
 * effect is declared after `useDayState`'s subscribe in the same component
 * and `inFlight` is already true.
 *
 * NO LOOP IS REACHABLE, and this is a proof rather than an assurance:
 * `refresh()` never writes a play record, so `settle` cannot be re-entered
 * from it; `settle` drops the record from the fallback queue, so the trigger
 * fires at most once per record; `inFlight` dedupes concurrent triggers; and
 * `settle(_, "recorded")` has exactly ONE call site (`acceptResponse` in
 * `play/sync.ts`, covering both the `recorded: true` and `recorded: false`
 * arms), so this is one condition and not two branches.
 *
 * Re-exported by `play/day-state.ts` as `refreshServerDay`, which is how the
 * play layer reaches it: ADR-0060 consequence (d)'s single-importer rule says
 * `src/day/**` is imported by `src/play/day-state.ts` and nothing else
 * (`T-WEB-S244`), and #64 does not spend that rule to save one hop.
 */
export function refreshDayTruth(): void {
  refresh();
}
