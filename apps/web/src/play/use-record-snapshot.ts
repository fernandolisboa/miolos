/**
 * The play record, subscribed rather than copied into component state
 * (ADR-0029, plan 018 §5.2 — moved out of `conclusion-view.tsx` so the hub,
 * the day state and every game's conclusion share one reader).
 *
 * `localStorage` is an external store, and `sync.ts` settles the record from
 * outside React — so views subscribe to it rather than reading it once in a
 * mount effect. Three things fall out of that:
 *
 * - the pre-hydration paint is free and exact (plan 017 D28): the server
 *   snapshot is a constant that says "not read yet", so the server markup
 *   and the first client paint agree on the skeleton and neither can flash
 *   the "ainda não concluído" card;
 * - a settled sync reaches the card without a notifier `sync.ts` does not
 *   have;
 * - nothing re-renders while nothing the reader shows has changed, because
 *   `readSnapshot` hands back the cached object in that case.
 */
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
 * Keyed on `{game, date}`, not on `date` alone (plan 018 §19.4): with two
 * conclusion routes live in one SPA session, `/binairo/concluido →
 * /sudoku/concluido` on the same day would otherwise hand back the Binairo
 * snapshot and stamp another game's time.
 *
 * ONE ENTRY PER KEY, not one slot (ADR-0056 decision 1). A single slot is
 * the same bug the paragraph above describes, one level down: N consumers
 * with different keys evict each other on every read, so every one of them
 * gets a fresh object back and React throws `Maximum update depth exceeded`.
 * It bites across GAMES — four per-game consumers on one page is what
 * `/arquivo/<data>`'s day card is — and across DATES, which is the axis that
 * went unrecorded until the date became a URL variable.
 *
 * NOTHING IS EVER EVICTED ON THE READ PATH, AT ANY N (ADR-0056 decision 1,
 * step-6 blocker B2). The first repair kept a count bound and trimmed inside
 * `readSnapshot`; measured, bound + 1 live consumers reinstated exactly the
 * loop the `Map` was introduced to delete — `Maximum update depth exceeded`
 * at 17 against a 16-entry cache, plain and in StrictMode. A cache whose
 * overflow is a white screen is worse than one that grows, and the guard was
 * weaker than it read: the test that held it pinned call-site FILES, so an
 * archive MONTH page reusing `day-card.tsx` (31 × 4 = 124 consumers) would
 * have added no file, stayed green and crashed. The count bound is gone. No
 * N of live consumers can loop, because a read can only ever ADD.
 *
 * WHAT BOUNDS IT INSTEAD IS STALENESS, SWEPT OFF THE POLL AND NEVER OFF A
 * READ. `subscribeToPlayRecords`'s interval calls `pruneStaleSnapshots`
 * before it notifies, dropping every entry no read has touched for
 * `SNAPSHOT_STALE_MS`. A live consumer is re-read once per second by its own
 * interval, so its entry's age is at most ~1 s and the sweep provably cannot
 * reach it; what the sweep collects is the keys left behind by navigation --
 * and only while some consumer is still mounted, since the interval IS the
 * collector. A page that unmounts every consumer leaves its keys until the
 * next mount ticks; retention is bounded by the session's distinct
 * (game, date) space, not by the sweep.
 * Its worst case is bounded degradation rather than a loop: if a background
 * tab's timers are throttled hard enough that a live entry does age past the
 * window, the sweep costs that consumer ONE extra render — the next read
 * re-caches the key, and no timer can fire between two `getSnapshot` calls
 * inside one synchronous render pass.
 *
 * AND THE `Map` WIDENS THE STALENESS WINDOW, deliberately. Under the single
 * slot a cached snapshot died the moment another key was read, so the fields
 * `sameToTheReader` does not compare (nonogram `grid`/`size`, termo `answer`/
 * `outcome`) could only ever be briefly stale. Under the `Map` an entry
 * survives as long as it is being read. That is safe ONLY because of the
 * lockstep invariants named below — `T-WEB-S64` and the termo record's
 * `superRefine` — which stop being belt-and-braces here and become
 * load-bearing.
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
 * THE POLL IS ALSO THE CACHE'S ONLY COLLECTOR (ADR-0056 decision 1). Sweep
 * first, notify second: the sweep drops what no consumer has read for
 * `SNAPSHOT_STALE_MS`, and the notify that follows re-stamps every live key.
 * Per hook instance it re-reads only its OWN key; the aggregate holds
 * because every live consumer owns an interval.
 *
 * Exported because `day-state.ts` subscribes to the same store with a
 * different projection (plan 018 §11.2) — one subscription mechanism, so a
 * settled sync can never reach one reader and not the other.
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
 * Deliberately not "everything a reader renders": #25's nonogram conclusion
 * also renders `size` and `grid` (`nonogram/nonogram-conclusion.tsx`), and
 * they are not compared here. That is safe only because of a lockstep
 * invariant — `buildRecord` writes `grid` exclusively in the same write that
 * flips `concluded` to true — so a payload change never happens while all
 * five of these stand still.
 *
 * That invariant is now CHECKED rather than argued: `T-WEB-S64` in
 * `test/nonogram-play.test.ts` — one id, one meaning again since step-6
 * round 4 — parses every byte a full play-through persists
 * and asserts `grid === undefined` iff `concluded` is false, on both sides.
 * A future game's `buildRecord` that breaks the lockstep goes red there.
 *
 * A per-game payload field that can move INDEPENDENTLY of `concluded` breaks
 * that and must be added below, or its reader will be handed a stale cached
 * snapshot and render the wrong picture. The next game owes its own copy of
 * T-WEB-S64.
 *
 * TERMO IS THAT GAME (#27, ADR-0044 consequence (d)), and it is why there is
 * a sixth term. `guesses` grows on every judged turn while all five chrome
 * fields stand still, so the COUNT is compared here (T-WEB-S78). `answer` and
 * `outcome` are deliberately NOT compared: the record's `superRefine` makes
 * their lockstep with `concluded` a parse-time invariant, so neither can move
 * on its own — the same claim nonogram's `grid` makes, now proved by a schema
 * rather than by a `buildRecord`. Termo's own copy of T-WEB-S64 therefore
 * asserts `answer`, never `guesses`.
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
