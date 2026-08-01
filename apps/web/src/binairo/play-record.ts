/**
 * The local play record (plan 017 D13/D18): in-flight state for today's
 * grid AND the sync queue for its completion. There is exactly one record
 * per (game, date), and its natural key is the same key that makes the
 * completion POST idempotent — so no second store exists.
 *
 * It is NEVER a source of truth. Streaks, statistics and the completion
 * instant all come from the server; the record carries a duration and no
 * timestamp of any kind, so the client clock can never enter streak
 * arithmetic (CLAUDE.md invariant).
 *
 * `localStorage`, not IndexedDB: one small record, a synchronous read is
 * available in the mount effect, and no schema machinery is warranted.
 * ADR-0001's follow-up already places in-flight state here.
 */
import { isoDateString } from "@miolos/core";
import { z } from "zod";

const STORAGE_PREFIX = "miolos:play:";

/** One day in milliseconds — the cap on a recorded session (see below). */
const ELAPSED_CAP_MS = 86_400_000;

export const playRecordKey = (game: "binairo", date: string) =>
  `${STORAGE_PREFIX}${game}:${date}`;

/**
 * Parsed on every read: `localStorage` is user-editable, i.e. untrusted
 * input crossing into the app (CLAUDE.md "parsed, never cast"). Strict, so
 * a smuggled key is a discard rather than a silent carry-through.
 *
 * `v: 1` is the version escape hatch — an unparseable or wrong-version
 * record is DISCARDED, never migrated. A migration path would be code that
 * runs once in the app's life and is never exercised again.
 */
export const playRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("binairo"),
  date: isoDateString,
  entries: z.array(z.union([z.literal(0), z.literal(1), z.null()])).length(64),
  /**
   * The SOLVED MERGED grid, written the moment `status` flips to `solved`.
   * The POST body needs `(0|1)[64]`, and the flush runs where the givens do
   * not exist in scope — on /binairo/concluido, on an `online` event, on a
   * cold mount. Reconstructing it from `entries` would need the givens,
   * which live only in /binairo's RSC props; without this field AC 3's
   * "syncs on reconnect" is unimplementable exactly where it matters.
   * Storing a solved PUBLISHED grid is inside ADR-0027's own argument: the
   * client can recompute it with solveBinairo(givens) in ~0.1 ms anyway.
   */
  grid: z
    .array(z.union([z.literal(0), z.literal(1)]))
    .length(64)
    .optional(),
  elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  /** Terminal disposition of the sync, for the conclusion's discreet line. */
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});

export type PlayRecord = z.infer<typeof playRecordSchema>;

/**
 * `localStorage` access that cannot throw. Safari's private mode throws on
 * the property itself, and there is no render path here — a missing store
 * simply means no record, which every caller already handles.
 */
function storage(): Storage | undefined {
  try {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Every stored key belonging to this app's play records, snapshotted. */
function playRecordKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

function parseAt(store: Storage, key: string): PlayRecord | undefined {
  const raw = store.getItem(key);
  if (raw === null) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = playRecordSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

/** The record for the SERVER's date, or `undefined` on absence or garbage. */
export function readPlayRecord(date: string): PlayRecord | undefined {
  const store = storage();
  return store === undefined
    ? undefined
    : parseAt(store, playRecordKey("binairo", date));
}

/**
 * Persist, clamping `elapsedMs` rather than rejecting it. A rejecting cap
 * would discard a player's in-progress grid on the next read and 400
 * forever on the wire; the cap exists to keep an untrusted number inside
 * an integer column, not to police a long session.
 *
 * Storage failures are swallowed: a full quota must cost the player
 * nothing more than the persistence they cannot have anyway.
 */
export function writePlayRecord(record: PlayRecord): void {
  const store = storage();
  if (store === undefined) {
    return;
  }
  const clamped: PlayRecord = {
    ...record,
    elapsedMs: Math.min(record.elapsedMs, ELAPSED_CAP_MS),
  };
  try {
    store.setItem(
      playRecordKey(clamped.game, clamped.date),
      JSON.stringify(clamped),
    );
  } catch {
    // QuotaExceededError and friends: nothing to retry, nothing to report.
  }
}

/** Every record still awaiting a completion POST — the queue, in full. */
export function listPendingRecords(): PlayRecord[] {
  const store = storage();
  if (store === undefined) {
    return [];
  }
  const pending: PlayRecord[] = [];
  for (const key of playRecordKeys(store)) {
    const record = parseAt(store, key);
    if (record?.pendingSync === true) {
      pending.push(record);
    }
  }
  return pending;
}

/**
 * Drop records for days before `keepDate` that have nothing left to sync.
 * `keepDate` is the SERVER's date (ADR-0010's single authority), never a
 * client-computed today — pruning on a wrong clock would delete a queue
 * that was about to flush. A pending record is kept forever by design: it
 * is the only copy of a completion the server has not acknowledged.
 */
export function prunePlayRecords(keepDate: string): void {
  const store = storage();
  if (store === undefined) {
    return;
  }
  for (const key of playRecordKeys(store)) {
    const record = parseAt(store, key);
    if (record !== undefined && !record.pendingSync && record.date < keepDate) {
      store.removeItem(key);
    }
  }
}
