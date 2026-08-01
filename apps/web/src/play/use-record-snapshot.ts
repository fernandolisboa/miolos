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
 */
let cachedSnapshot:
  | {
      readonly game: Game;
      readonly date: string;
      readonly snapshot: RecordSnapshot;
    }
  | undefined;

function readSnapshot(game: Game, date: string): RecordSnapshot {
  const next = readPlayRecord(game, date);
  const cached = cachedSnapshot;
  if (
    cached?.game === game &&
    cached.date === date &&
    cached.snapshot.hydrated &&
    sameToTheReader(cached.snapshot.record, next)
  ) {
    return cached.snapshot;
  }
  const snapshot: RecordSnapshot = { hydrated: true, record: next };
  cachedSnapshot = { game, date, snapshot };
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

/** Everything a reader of a single record actually renders from it. */
function sameToTheReader(
  previous: PlayRecord | undefined,
  next: PlayRecord | undefined,
): boolean {
  return (
    previous?.concluded === next?.concluded &&
    previous?.pendingSync === next?.pendingSync &&
    previous?.syncOutcome === next?.syncOutcome &&
    previous?.elapsedMs === next?.elapsedMs &&
    previous?.hintsUsed === next?.hintsUsed
  );
}
