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
 * - NOTHING ELSE. There is NO INTERVAL, and that is a decision with a named
 *   cost rather than a gate borrowed from ADR-0056 (whose decision 1 governs
 *   a 1 s `localStorage` poll and says nothing about a network refresh). A
 *   polling network loop would multiply the credentialed GETs on the most-hit
 *   route in the app, for a payload that can change at most four times a day,
 *   and every trigger above is an event the player actually generated.
 *
 *   THE RESIDUAL, stated rather than left to be found: an already-open,
 *   already-focused tab does not learn about a completion made elsewhere
 *   until it is refocused or navigated. A second monitor left on the hub —
 *   this ticket's own demo case — never updates on its own. Accepted for v1;
 *   the successor is a poll or a push, and the trigger for revisiting is a
 *   complaint, not a schedule (ADR-0060 decision 5).
 *
 * CLEANUP DROPS THE LISTENERS AND RETAINS THE PAYLOAD. The last unsubscribe
 * removes the three window/document handlers and leaves the cached value in
 * place; only the date precondition in `day-state.ts` retires it. Clearing it
 * would flip the snapshot to `undefined` and demote every cross-device tile
 * to pending for the length of a fetch, on every navigation.
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

/** Field for field: date plus the four statuses. Nothing else is on it. */
function samePayload(previous: DayResponse, next: DayResponse): boolean {
  return (
    previous.date === next.date &&
    previous.games.termo === next.games.termo &&
    previous.games.sudoku === next.games.sudoku &&
    previous.games.nonogram === next.games.nonogram &&
    previous.games.binairo === next.games.binairo
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
 */
function refresh(): void {
  if (inFlight) {
    return;
  }
  inFlight = true;
  void fetchDayTruth().then((next) => {
    inFlight = false;
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
  });
}

function onVisibilityChange(): void {
  if (document.visibilityState === "visible") {
    refresh();
  }
}

function subscribe(onStoreChange: () => void): () => void {
  const wasEmpty = listeners.size === 0;
  listeners.add(onStoreChange);
  if (wasEmpty) {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    refresh();
  }
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0) {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      // The payload is RETAINED on purpose — see the header.
    }
  };
}

/** The server's day truth, live. `undefined` until (or unless) one lands. */
export function useDayTruth(): DayResponse | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
