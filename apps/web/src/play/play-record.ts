/**
 * The local play record: in-flight state for today's grid AND the sync queue
 * for its completion, one per (game, date), keyed by the same key that makes
 * the completion POST idempotent.
 *
 * It is NEVER a source of truth. The record carries a duration and no
 * timestamp of any kind, so the client clock can never enter streak
 * arithmetic (CLAUDE.md invariant). See ADR-0029.
 */
import {
  completionOutcomeSchema,
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
  TERMO_MAX_GUESSES,
  TERMO_WORD_LENGTH,
  termoGuessWordSchema,
  termoTilesSchema,
  type Game,
} from "@miolos/core";
import { z } from "zod";

const STORAGE_PREFIX = "miolos:play:";

/** One day in milliseconds — the same bound the completion contract carries. */
export const ELAPSED_CAP_MS = 86_400_000;

/**
 * The largest board area any legal Nonogram record can hold, DERIVED from
 * `nonogramSizeSchema` rather than hand-written so that a fifth size class
 * moves it instead of leaving a stale literal behind.
 */
const MAX_NONOGRAM_CELLS = Math.max(
  ...nonogramSizeSchema.options.map((option) => option.value ** 2),
);

export const playRecordKey = (game: Game, date: string) =>
  `${STORAGE_PREFIX}${game}:${date}`;

/**
 * An unparseable or wrong-version record is DISCARDED, never migrated.
 *
 * `v` STAYS 1 across the whole union: bumping it discards every stored record
 * on deploy, and a discarded record with `pendingSync: true` is the only copy
 * of a completion the server has not acknowledged — a lost streak day.
 * See ADR-0029 consequence (d).
 */
export const binairoPlayRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("binairo"),
  date: isoDateString,
  entries: z.array(z.union([z.literal(0), z.literal(1), z.null()])).length(64),
  /**
   * The SOLVED MERGED grid, written the moment `status` flips to `solved`.
   * The flush runs where the givens do not exist in scope — /binairo/concluido,
   * an `online` event, a cold mount — so it cannot be reconstructed from
   * `entries` there.
   */
  grid: z
    .array(z.union([z.literal(0), z.literal(1)]))
    .length(64)
    .optional(),
  elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});

export type BinairoPlayRecord = z.infer<typeof binairoPlayRecordSchema>;

/**
 * `null` for an empty cell and 1–9 for a written digit — the engine's `0`
 * sentinel never reaches this type.
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
 * `size` is a DATUM, not `Math.sqrt(entries.length)`: `sync.ts` builds the
 * POST body from the record ALONE with no board in scope, and the
 * conclusion's picture wrapper lays the bitmap out from it. It is also why no
 * fixed `.length()` is available — the `superRefine` is what bounds the arrays
 * against it, and `writePlayRecord` does not parse on write, so the schema on
 * READ is the only wall there is.
 *
 * `.max(MAX_NONOGRAM_CELLS)` is a plain length CEILING and is deliberately NOT
 * an allocation bound: array element parsing runs BEFORE array-level checks in
 * zod 4.
 *
 * A checked object is a legal `z.discriminatedUnion` option in Zod 4 and is
 * NOT one in Zod 3 (there it is a `ZodEffects`), so a downgrade breaks this
 * file at CONSTRUCTION time, not at parse time.
 */
export const nonogramPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,
    /** 1 = preenchida, 0 = marcada, null = vazia. size² of them. */
    entries: z
      .array(z.union([z.literal(0), z.literal(1), z.null()]))
      .max(MAX_NONOGRAM_CELLS),
    /**
     * The SUBMITTED bitmap, NOT "the player's board": crossed and undecided
     * cells are both `0` here, because the completion predicate is "the
     * picture is painted" (ADR-0032), so on a closed board this array IS the
     * solution.
     */
    grid: z
      .array(z.union([z.literal(0), z.literal(1)]))
      .max(MAX_NONOGRAM_CELLS)
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

// THIS MODULE IMPORTS NOTHING FROM `@miolos/games/termo` — not a value, and
// not even a type. It is on EVERY route's client graph (`day-state.ts` reads
// it for the hub's meta line and every card's action), so a value import would
// put the Termo engine, and the word list with it, on `/` (ADR-0045). Nothing
// enforces this: the `@miolos/games/termo` lint ban is scoped to free play.
// The bounds this member needs come from `@miolos/core`'s client-safe
// `contracts/termo-guess.ts` instead.

/**
 * WHAT IT HOLDS: the JUDGED GUESS ROWS, and nothing in flight. A guess the
 * server has not answered lives in reducer state and never reaches storage —
 * a persisted unjudged row could never be filled in (the client has no answer
 * to judge against), so a reload would find a row with no tiles that had
 * already spent one of six attempts.
 *
 * WHY THE TILES ARE STORED. `evaluateGuess(guess, answer)` needs the answer,
 * and termo's public projection is `game, date` only. Mid-play there is no
 * answer in scope, so a record without tiles cannot re-render the board after
 * a reload. This is not an optimisation.
 *
 * `answer` is here rather than read off the completion response because
 * `acceptResponse` copies only `elapsedMs`/`hintsUsed`, and only on the
 * `recorded: false` branch; without it /termo/concluido cannot show the word.
 *
 * `outcome` is STORED, not derived from the tiles, because `day-state.ts`
 * reads this record on every route and must never import a game engine (see
 * the import note above).
 *
 * THE SUPERREFINE IS NOT DECORATION. `deriveBoardStatus` raises RangeError for
 * more than MAX_GUESSES rows and for any row following an all-correct row, so
 * a record violating either has to be UNPARSEABLE rather than merely
 * unexpected: `.max(TERMO_MAX_GUESSES)` covers the first and the winning-row
 * check below covers the second. The other three checks make the
 * payload/`concluded` lockstep a PARSE-TIME invariant.
 *
 * See ADR-0044.
 */
export const termoPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("termo"),
    date: isoDateString,
    /** Judged rows only, oldest first. Structurally `EvaluatedGuess`. */
    guesses: z
      .array(
        z.strictObject({
          // A guess as the engine sees it: normalized, five letters, no
          // accents.
          guess: termoGuessWordSchema,
          tiles: termoTilesSchema,
        }),
      )
      .max(TERMO_MAX_GUESSES),
    /** The ANSWER's canonical accented spelling (ADR-0015). */
    answer: z.string().length(TERMO_WORD_LENGTH).optional(),
    /** Never posted — the server judges. */
    outcome: completionOutcomeSchema.optional(),
    elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
    hintsUsed: z.number().int().min(0).max(1),
    concluded: z.boolean(),
    pendingSync: z.boolean(),
    syncOutcome: z.enum(["pending", "recorded", "rejected"]),
  })
  .superRefine((record, ctx) => {
    const wonAt = record.guesses.findIndex((row) =>
      row.tiles.every((tile) => tile === "correct"),
    );
    if (wonAt !== -1 && wonAt !== record.guesses.length - 1) {
      ctx.addIssue({
        code: "custom",
        message: "no guess may follow a winning row",
        path: ["guesses"],
      });
    }
    if (record.concluded !== (record.answer !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "answer is written exactly when the board closes",
        path: ["answer"],
      });
    }
    if (record.concluded !== (record.outcome !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "outcome is written exactly when the board closes",
        path: ["outcome"],
      });
    }
    if (record.concluded && record.guesses.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "a closed board has at least one judged guess",
        path: ["guesses"],
      });
    }
  });

export type TermoPlayRecord = z.infer<typeof termoPlayRecordSchema>;

export const playRecordSchema = z.discriminatedUnion("game", [
  binairoPlayRecordSchema,
  nonogramPlayRecordSchema,
  sudokuPlayRecordSchema,
  termoPlayRecordSchema,
]);

export type PlayRecord = z.infer<typeof playRecordSchema>;

/**
 * `localStorage` access that cannot throw: Safari's private mode throws on
 * the property itself.
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

/**
 * Whether a play record could EVER be read on this device. `readPlayRecord`
 * returning `undefined` is two different facts wearing one answer: "not
 * written yet", which resolves in a commit or two, and "this browser has no
 * store", which never resolves. Only the second one makes a gated control
 * permanently dead, and `storage()` is exactly the predicate that separates
 * them.
 *
 * A RENDER-TIME CALL IS SAFE HERE: the only caller renders behind
 * `snapshot.hydrated`, which is `false` for the server markup and for the
 * hydrating client render both, so no branch on this value is ever part of a
 * tree React has to match.
 */
export function playRecordsAvailable(): boolean {
  return storage() !== undefined;
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
 * garbage, or on a record that does not ADDRESS the key it was found under —
 * a hand-edited store must never feed a 64-cell binairo record into an
 * 81-cell sudoku grid, nor yesterday's board into today's screen.
 */
export function readPlayRecord(
  game: Game,
  date: string,
): PlayRecord | undefined {
  const store = storage();
  if (store === undefined) {
    return undefined;
  }
  const key = playRecordKey(game, date);
  const record = parseAt(store, key);
  return record !== undefined && playRecordKey(record.game, record.date) === key
    ? record
    : undefined;
}

/**
 * Persist, clamping `elapsedMs` rather than rejecting it: a rejecting cap
 * would discard a player's in-progress grid on the next read. Storage failures
 * are swallowed.
 */
export function writePlayRecord(record: PlayRecord): void {
  const store = storage();
  if (store === undefined) {
    return;
  }
  const clamped: PlayRecord = {
    ...record,
    // Clamped at BOTH ends, where the schema validates both: a backward
    // wall-clock step makes `now - runningSince` negative, and a negative
    // `elapsedMs` written verbatim is discarded by the very next parse —
    // losing the player's in-progress grid, or a completion the queue can then
    // never find.
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
 * deliberately GAME-BLIND. That is exactly why `sync.ts` can be one module for
 * every game, and why it MUST be (ADR-0029).
 *
 * Game-blind is not key-blind. `sync.ts` settles a record with
 * `writePlayRecord`, which derives the key from the RECORD, so a record
 * sitting at a key its own `(game, date)` does not produce would be settled
 * into a different key and left pending at this one — re-POSTed forever,
 * because a pending record is never pruned by design.
 */
export function listPendingRecords(): PlayRecord[] {
  const store = storage();
  if (store === undefined) {
    return [];
  }
  const pending: PlayRecord[] = [];
  for (const key of playRecordKeys(store)) {
    const record = parseAt(store, key);
    if (
      record?.pendingSync === true &&
      playRecordKey(record.game, record.date) === key
    ) {
      pending.push(record);
    }
  }
  return pending;
}

/** How many SETTLED past records survive a prune. See ADR-0053. */
const RETAINED_PAST_RECORDS = 50;

/**
 * Keep the 50 most recent settled records dated before `keepDate`, and drop
 * the rest. `keepDate` is the SERVER's date, never a client-computed today —
 * pruning on a wrong clock would delete a queue that was about to flush. A
 * pending record is kept forever by design: it is the only copy of a
 * completion the server has not acknowledged.
 *
 * The ordering key is `record.date`, because it is the only orderable field
 * the record has. So a player already holding 50 settled archive records who
 * then solves a date older than all of them loses that result on the next
 * prune.
 *
 * The ONE unconditional drop is a record that does not address its own key: it
 * is unsyncable by construction (see `listPendingRecords` above), so keeping
 * it forever keeps nothing. Unparseable keys are left alone — this function
 * owns the play namespace's records, not its garbage.
 *
 * See ADR-0053.
 */
export function prunePlayRecords(keepDate: string): void {
  const store = storage();
  if (store === undefined) {
    return;
  }
  const candidates: { key: string; date: string }[] = [];
  for (const key of playRecordKeys(store)) {
    const record = parseAt(store, key);
    if (record === undefined) {
      continue;
    }
    if (playRecordKey(record.game, record.date) !== key) {
      store.removeItem(key);
      continue;
    }
    if (!record.pendingSync && record.date < keepDate) {
      candidates.push({ key, date: record.date });
    }
  }
  // Newest FIRST, key as the tiebreak: `playRecordKeys` walks the store in
  // whatever order the browser hands back, so without a total order the same
  // store could prune two different records on two runs.
  candidates.sort((a, b) =>
    a.date === b.date
      ? a.key.localeCompare(b.key)
      : b.date.localeCompare(a.date),
  );
  for (const stale of candidates.slice(RETAINED_PAST_RECORDS)) {
    store.removeItem(stale.key);
  }
}
