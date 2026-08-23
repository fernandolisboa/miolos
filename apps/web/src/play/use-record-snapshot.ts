import type { Game } from "@miolos/core";
import { useCallback, useSyncExternalStore } from "react";

import { readPlayRecord, type PlayRecord } from "./play-record";

export type RecordSnapshot =
  | { readonly hydrated: false }
  | { readonly hydrated: true; readonly record: PlayRecord | undefined };

const SERVER_SNAPSHOT: RecordSnapshot = { hydrated: false };

const serverSnapshot = (): RecordSnapshot => SERVER_SNAPSHOT;

/**
 * The snapshot cache the store contract requires: `getSnapshot` has to
 * return a referentially stable value or `useSyncExternalStore` loops
 * forever, and a fresh `JSON.parse` never is. Module-level because the
 * store it caches is — one browser has one `localStorage`.
 *
 * ONE ENTRY PER `{game, date}`, not one slot, and nothing is ever evicted on
 * the read path at any N (see ADR-0056): N consumers sharing one slot evict
 * each other on every read, so every one of them gets a fresh object back and
 * React throws `Maximum update depth exceeded`.
 *
 * WHAT BOUNDS IT INSTEAD IS STALENESS, SWEPT OFF THE POLL AND NEVER OFF A
 * READ: `subscribeToPlayRecords` drops every entry no read has touched for
 * `SNAPSHOT_STALE_MS`. Since that interval IS the collector, a page that
 * unmounts every consumer leaves its keys until the next mount ticks —
 * retention is bounded by the session's distinct (game, date) space, not by
 * the sweep.
 *
 * AND THE `Map` WIDENS THE STALENESS WINDOW, deliberately: an entry survives
 * as long as it is being read, so the fields `sameToTheReader` does not
 * compare (nonogram `grid`/`size`, termo `answer`/`outcome`) can be stale for
 * that long. That is safe ONLY because of the lockstep invariants named below
 * — `T-WEB-S64` and the termo record's `superRefine` — which stop being
 * belt-and-braces here and become load-bearing.
 */
interface CachedSnapshot {
  readonly snapshot: Extract<RecordSnapshot, { hydrated: true }>;
  /** `Date.now()` at the last read this entry answered. Mutable on purpose:
   *  touching it must NOT disturb `snapshot`'s identity. */
  lastReadAt: number;
}

/**
 * How long an entry survives with nothing reading it. Five times the poll
 * interval, so an entry belonging to a live consumer cannot be swept even if
 * four consecutive ticks are dropped.
 */
export const SNAPSHOT_STALE_MS = 5_000;

const cachedSnapshots = new Map<string, CachedSnapshot>();

function readSnapshot(game: Game, date: string): RecordSnapshot {
  const next = readPlayRecord(game, date);
  const key = `${game}|${date}`;
  const cached = cachedSnapshots.get(key);
  if (cached !== undefined && sameToTheReader(cached.snapshot.record, next)) {
    cached.lastReadAt = Date.now();
    return cached.snapshot;
  }
  const snapshot = { hydrated: true, record: next } as const;
  cachedSnapshots.set(key, { snapshot, lastReadAt: Date.now() });
  return snapshot;
}

/**
 * The sweep, exported so `T-WEB-S214` can drive it directly instead of
 * waiting out real time. Deleting from a `Map` while iterating it is defined
 * and safe; a clock that goes backwards makes ages negative, which errs
 * towards keeping an entry.
 */
export function pruneStaleSnapshots(now: number = Date.now()): void {
  for (const [key, entry] of cachedSnapshots) {
    if (now - entry.lastReadAt > SNAPSHOT_STALE_MS) cachedSnapshots.delete(key);
  }
}

/**
 * A 1 s poll, because `sync.ts` exposes no notifier and `storage` fires only
 * in OTHER tabs. It costs one read and one parse per second and, thanks to
 * the caches its consumers keep, zero re-renders while the records stand
 * still.
 *
 * THE POLL IS ALSO THE CACHE'S ONLY COLLECTOR (see ADR-0056). Sweep
 * first, notify second: the sweep drops what no consumer has read for
 * `SNAPSHOT_STALE_MS`, and the notify that follows re-stamps every live key.
 * Per hook instance it re-reads only its OWN key; the aggregate holds
 * because every live consumer owns an interval.
 *
 * Exported because `day-state.ts` subscribes to the same store with a
 * different projection — one subscription mechanism, so a settled sync can
 * never reach one reader and not the other.
 */
export function subscribeToPlayRecords(onStoreChange: () => void): () => void {
  const interval = setInterval(() => {
    pruneStaleSnapshots();
    onStoreChange();
  }, 1000);
  window.addEventListener("storage", onStoreChange);
  return () => {
    clearInterval(interval);
    window.removeEventListener("storage", onStoreChange);
  };
}

/** This device's record for (`game`, the SERVER's `date`), live. */
export function useRecordSnapshot(game: Game, date: string): RecordSnapshot {
  return useSyncExternalStore(
    subscribeToPlayRecords,
    useCallback(() => readSnapshot(game, date), [game, date]),
    serverSnapshot,
  );
}

/**
 * The five CHROME fields every reader of a record renders from it, plus the
 * one per-game payload field that moves independently of them.
 *
 * Deliberately not "everything a reader renders": the nonogram conclusion
 * also renders `size` and `grid` (`nonogram/nonogram-conclusion.tsx`), and
 * they are not compared here. That is safe only because of a lockstep
 * invariant — `buildRecord` writes `grid` exclusively in the same write that
 * flips `concluded` to true, which `T-WEB-S64` checks — so a payload change
 * never happens while all five of these stand still.
 *
 * A per-game payload field that can move INDEPENDENTLY of `concluded` breaks
 * that and must be added below, or its reader will be handed a stale cached
 * snapshot and render the wrong picture. The next game owes its own copy of
 * T-WEB-S64.
 *
 * TERMO IS THAT GAME, and it is why there is a sixth term. `guesses` grows on
 * every judged turn while all five chrome fields stand still, so the COUNT is
 * compared here (T-WEB-S78). `answer` and `outcome` are deliberately NOT
 * compared: the record's `superRefine` makes their lockstep with `concluded`
 * a parse-time invariant, so neither can move on its own.
 *
 * `-1` for a non-termo record is a value no array length can take, so the
 * term is inert for the three shipped games.
 */
function sameToTheReader(
  previous: PlayRecord | undefined,
  next: PlayRecord | undefined,
): boolean {
  return (
    previous?.concluded === next?.concluded &&
    previous?.pendingSync === next?.pendingSync &&
    previous?.syncOutcome === next?.syncOutcome &&
    previous?.elapsedMs === next?.elapsedMs &&
    previous?.hintsUsed === next?.hintsUsed &&
    (previous?.game === "termo" ? previous.guesses.length : -1) ===
      (next?.game === "termo" ? next.guesses.length : -1)
  );
}
