/**
 * The local play record (plan 017 D13/D18, ADR-0029): in-flight state for
 * today's grid AND the sync queue for its completion. There is exactly one
 * record per (game, date), and its natural key is the same key that makes
 * the completion POST idempotent — so no second store exists.
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
import {
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
  type Game,
} from "@miolos/core";
import { z } from "zod";

const STORAGE_PREFIX = "miolos:play:";

/**
 * One day in milliseconds — the cap on a recorded session (see below), and
 * the same bound the completion contract carries. Exported because
 * `sync.ts` clamps against it on the memory-queue path; it used to be
 * declared once here and once there (plan 018 §5.2).
 */
export const ELAPSED_CAP_MS = 86_400_000;

export const playRecordKey = (game: Game, date: string) =>
  `${STORAGE_PREFIX}${game}:${date}`;

/**
 * Parsed on every read: `localStorage` is user-editable, i.e. untrusted
 * input crossing into the app (CLAUDE.md "parsed, never cast"). Strict, so
 * a smuggled key is a discard rather than a silent carry-through.
 *
 * `v: 1` is the version escape hatch — an unparseable or wrong-version
 * record is DISCARDED, never migrated. A migration path would be code that
 * runs once in the app's life and is never exercised again.
 *
 * `v` STAYS 1 across the whole union (plan 018 S17, ADR-0029 consequence
 * (d)): bumping it discards every stored record on deploy, and a discarded
 * record with `pendingSync: true` is the only copy of a completion the
 * server has not acknowledged — a lost streak day.
 */
export const binairoPlayRecordSchema = z.strictObject({
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

export type BinairoPlayRecord = z.infer<typeof binairoPlayRecordSchema>;

/**
 * The sudoku member (plan 018 §9.1). Identical to the binairo member in
 * every field the board does not own, and different only where it does: 81
 * cells, `null` for empty and 1–9 for a written digit — the engine's `0`
 * sentinel never reaches this type (plan 018 S6). `sudokuDigitSchema` comes
 * from `@miolos/core` and is never re-declared: one definition, three
 * consumers (the daily contract, the completion request and this).
 */
export const sudokuPlayRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("sudoku"),
  date: isoDateString,
  entries: z.array(z.union([sudokuDigitSchema, z.null()])).length(81),
  /** The SOLVED MERGED grid — see the binairo member for why it is stored. */
  grid: z.array(sudokuDigitSchema).length(81).optional(),
  elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});

export type SudokuPlayRecord = z.infer<typeof sudokuPlayRecordSchema>;

/**
 * The nonogram member (#25, plan 020 §14.1). Structurally binairo's —
 * 0/1/null cells, one optional solved `grid` — with one field neither
 * shipped game needs: `size`. A Nonogram board is 5, 8, 10 or 15 a side
 * depending on the weekday (difficulty.ts:31-41), so no fixed `.length()` is
 * available and a stored record would otherwise not say which board it
 * belongs to.
 *
 * `size` is a DATUM, not `Math.sqrt(entries.length)`: `sync.ts` builds the
 * POST body from the record ALONE with no board in scope, and the
 * conclusion's picture wrapper lays the bitmap out from it.
 *
 * The `superRefine` is what bounds the arrays. `writePlayRecord` does not
 * parse on write (:180-203), so the schema on READ is the only wall there is.
 * `.max(225)` is a plain length CEILING, and it is deliberately NOT sold as
 * an allocation bound: measured against the installed zod 4.4.3, array
 * element parsing runs BEFORE array-level checks, so
 * `z.array(union).max(225).safeParse(new Array(1_000_000).fill(0))` parses
 * all 1 000 000 elements first (`{success:false, ms:35, elementChecksRun:
 * 1000000}`) and then fails the length test. What `.max(225)` buys is a
 * schema-level statement of the record's maximum board area that holds
 * independently of `size`, so an absurd but internally size-consistent
 * record is refused by a bound and not only by the cross-refine. The two
 * shipped members have the identical property (`.length(64)`/`.length(81)`
 * also iterate first), so nothing regresses here.
 *
 * `nonogramSizeSchema` comes from @miolos/core and is never re-declared: one
 * definition, three consumers, exactly as `sudokuDigitSchema` is.
 *
 * A checked object is a legal `z.discriminatedUnion` option in Zod 4 and is
 * NOT one in Zod 3 (there it is a `ZodEffects`). Verified against the
 * installed zod 4.4.3; a downgrade breaks this file at CONSTRUCTION time,
 * not at parse time.
 */
export const nonogramPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,
    /** 1 = preenchida, 0 = marcada, null = vazia. size² of them. */
    entries: z.array(z.union([z.literal(0), z.literal(1), z.null()])).max(225),
    /**
     * The SUBMITTED bitmap, written the moment `status` flips to `solved`.
     * NOT "the player's board": crossed and undecided cells are both `0`
     * here, because the completion predicate is "the picture is painted"
     * (ADR-0032), so on a closed board this array IS the solution.
     */
    grid: z
      .array(z.union([z.literal(0), z.literal(1)]))
      .max(225)
      .optional(),
    elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
    hintsUsed: z.number().int().min(0).max(1),
    concluded: z.boolean(),
    pendingSync: z.boolean(),
    syncOutcome: z.enum(["pending", "recorded", "rejected"]),
  })
  .superRefine((record, ctx) => {
    const cells = record.size ** 2;
    if (record.entries.length !== cells) {
      ctx.addIssue({
        code: "custom",
        message: `entries must hold ${String(cells)} cells on a ${String(record.size)}×${String(record.size)} board`,
        path: ["entries"],
      });
    }
    if (record.grid !== undefined && record.grid.length !== cells) {
      ctx.addIssue({
        code: "custom",
        message: `grid must hold ${String(cells)} cells on a ${String(record.size)}×${String(record.size)} board`,
        path: ["grid"],
      });
    }
  });

export type NonogramPlayRecord = z.infer<typeof nonogramPlayRecordSchema>;

/**
 * EXTENSION POINT: #27 adds its member here; the discriminator is `game`,
 * exactly as it is on the wire contracts.
 */
export const playRecordSchema = z.discriminatedUnion("game", [
  binairoPlayRecordSchema,
  nonogramPlayRecordSchema,
  sudokuPlayRecordSchema,
]);

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

/**
 * The record at (`game`, the SERVER's date), or `undefined` on absence, on
 * garbage, or on a record whose own `game` does not match the key it was
 * found under — a hand-edited store must never feed a 64-cell binairo
 * record into an 81-cell sudoku grid (plan 018 S17, landmine 3).
 */
export function readPlayRecord(
  game: Game,
  date: string,
): PlayRecord | undefined {
  const store = storage();
  if (store === undefined) {
    return undefined;
  }
  const record = parseAt(store, playRecordKey(game, date));
  return record?.game === game ? record : undefined;
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
    // Clamped at BOTH ends, where the schema validates both: a backward
    // wall-clock step (an NTP correction, a device clock change) makes
    // `now - runningSince` negative, and a negative `elapsedMs` written
    // verbatim is discarded by the very next parse — losing the player's
    // in-progress grid, or a completion the queue can then never find
    // (finding `elapsedms-clamp-is-one-sided`).
    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
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

/**
 * Every record still awaiting a completion POST — the queue, in full, and
 * deliberately GAME-BLIND. That is exactly why `sync.ts` can be one module
 * for every game, and why it MUST be (ADR-0029, plan 018 S1): two copies
 * over this one queue would each POST and each settle the other's records.
 */
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
