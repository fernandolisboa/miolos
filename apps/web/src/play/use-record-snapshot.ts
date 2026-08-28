import type { Game } from "@miolos/core";
import { useCallback, useSyncExternalStore } from "react";

import { readPlayRecord, type PlayRecord } from "./play-record";

export type RecordSnapshot =
  | { readonly hydrated: false }
  | { readonly hydrated: true; readonly record: PlayRecord | undefined };

const SERVER_SNAPSHOT: RecordSnapshot = { hydrated: false };

const serverSnapshot = (): RecordSnapshot => SERVER_SNAPSHOT;

interface CachedSnapshot {
  readonly snapshot: Extract<RecordSnapshot, { hydrated: true }>;

  lastReadAt: number;
}

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

export function pruneStaleSnapshots(now: number = Date.now()): void {
  for (const [key, entry] of cachedSnapshots) {
    if (now - entry.lastReadAt > SNAPSHOT_STALE_MS) cachedSnapshots.delete(key);
  }
}

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

export function useRecordSnapshot(game: Game, date: string): RecordSnapshot {
  return useSyncExternalStore(
    subscribeToPlayRecords,
    useCallback(() => readSnapshot(game, date), [game, date]),
    serverSnapshot,
  );
}

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
