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
import { GAMES, type Game } from "@miolos/core";
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
 * THE BOUND IS A FLOOR, NOT A BUDGET: it must be AT LEAST the largest number
 * of simultaneously-mounted consumers, because eviction below that count
 * reinstates the loop. Measured: 16 live consumers against a 16-entry cache
 * are stable, 17 loop. Today the shipped maximum is 2 (a conclusion nests
 * one per-game consumer inside one shared one); the archive day card makes it
 * 4. `T-WEB-S214` holds a floor under the constant and pins the inventory of
 * call-site FILES — which is not the same as pinning the mount count, so a
 * surface that reuses an existing call site (an archive MONTH page would
 * mount 31 × 4 through the day card) has to be read against ADR-0056
 * decision 1 rather than against that test.
 *
 * AND IT WIDENS THE STALENESS WINDOW, deliberately. Under the single slot a
 * cached snapshot died the moment another key was read, so the fields
 * `sameToTheReader` does not compare (nonogram `grid`/`size`, termo `answer`/
 * `outcome`) could only ever be briefly stale. Under the `Map` an entry
 * survives the whole session. That is safe ONLY because of the lockstep
 * invariants named below — `T-WEB-S64` and the termo record's `superRefine` —
 * which stop being belt-and-braces here and become load-bearing.
 */
export const SNAPSHOT_CACHE_LIMIT = GAMES.length * 4;

const cachedSnapshots = new Map<
  string,
  Extract<RecordSnapshot, { hydrated: true }>
>();

function readSnapshot(game: Game, date: string): RecordSnapshot {
  const next = readPlayRecord(game, date);
  const key = `${game}|${date}`;
  const cached = cachedSnapshots.get(key);
  if (cached !== undefined && sameToTheReader(cached.record, next)) {
    return cached;
  }
  const snapshot = { hydrated: true, record: next } as const;
  // Written FIRST, trimmed after, so the key just read can never be the key
  // evicted — the one ordering that cannot hand its own caller a fresh object
  // on the very next read.
  cachedSnapshots.set(key, snapshot);
  if (cachedSnapshots.size > SNAPSHOT_CACHE_LIMIT) {
    const oldest = cachedSnapshots.keys().next().value;
    if (oldest !== undefined) cachedSnapshots.delete(oldest);
  }
  return snapshot;
}

/**
 * A 1 s poll, because `sync.ts` exposes no notifier and `storage` fires only
 * in OTHER tabs. It costs one read and one parse per second and, thanks to
 * the caches its consumers keep, zero re-renders while the records stand
 * still.
 *
 * Exported because `day-state.ts` subscribes to the same store with a
 * different projection (plan 018 §11.2) — one subscription mechanism, so a
 * settled sync can never reach one reader and not the other.
 */
export function subscribeToPlayRecords(onStoreChange: () => void): () => void {
  const interval = setInterval(onStoreChange, 1000);
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
