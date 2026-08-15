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

/**
 * One day in milliseconds — the cap on a recorded session (see below), and
 * the same bound the completion contract carries. Exported because
 * `sync.ts` clamps against it on the memory-queue path; it used to be
 * declared once here and once there (plan 018 §5.2).
 */
export const ELAPSED_CAP_MS = 86_400_000;

/**
 * The largest board area any legal Nonogram record can hold, DERIVED from
 * `nonogramSizeSchema` rather than hand-written — the same rule
 * `NONOGRAM_CELL_COUNTS` follows in `packages/core/src/contracts/completion.ts`
 * for the same fact. A literal `225` here would have been the fourth hand
 * copy of a number the size union already fixes, and it is exactly the copy
 * that goes stale on the day a fifth size class lands (step-6 round-4
 * finding Q1). `[5, 8, 10, 15] -> 225`.
 */
const MAX_NONOGRAM_CELLS = Math.max(
  ...nonogramSizeSchema.options.map((option) => option.value ** 2),
);

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
 * parse on write (see the function itself, below), so the schema on READ is
 * the only wall there is.
 * `.max(MAX_NONOGRAM_CELLS)` is a plain length CEILING, and it is
 * deliberately NOT sold as an allocation bound: measured against the
 * installed zod 4.4.3, array element parsing runs BEFORE array-level checks,
 * so `z.array(union).max(225).safeParse(new Array(1_000_000).fill(0))` parses
 * all 1 000 000 elements first (`{success:false, ms:35, elementChecksRun:
 * 1000000}`) and then fails the length test. The two shipped members have the
 * identical property (`.length(64)`/`.length(81)` also iterate first), so
 * nothing regresses here.
 *
 * IT IS REDUNDANT TODAY, and that is stated rather than dressed up. This
 * paragraph used to claim the bound "refuses an absurd but internally
 * size-consistent record that the cross-refine would accept"; no such record
 * exists, because `size` is a four-member literal union so a size-consistent
 * `entries` length is one of 25/64/100/225 and every one of them clears the
 * ceiling — and when the ceiling DOES fire, the `superRefine` fires in the
 * same parse, so it never rejects alone. That was the second false rationale
 * on this one declaration (step-6 round-4 finding Q1, after CLI-4/SRV-6). It
 * is kept as a belt on the largest legal board area, derived from the size
 * union so that a fifth size class moves it automatically instead of leaving
 * a stale literal behind.
 *
 * `nonogramSizeSchema` comes from @miolos/core and is never re-declared: one
 * definition, four consumers, exactly as `sudokuDigitSchema` is.
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
    entries: z
      .array(z.union([z.literal(0), z.literal(1), z.null()]))
      .max(MAX_NONOGRAM_CELLS),
    /**
     * The SUBMITTED bitmap, written the moment `status` flips to `solved`.
     * NOT "the player's board": crossed and undecided cells are both `0`
     * here, because the completion predicate is "the picture is painted"
     * (ADR-0032), so on a closed board this array IS the solution.
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
// not even a type. The VALUE half is load-bearing: this module is on EVERY
// route's client graph (`day-state.ts` reads it for the hub's meta line and
// every card's action), so a value import would put the Termo engine on `/` —
// and, the day one of `word-list.ts`'s two `/*#__PURE__*/` annotations is lost
// to a refactor, the word list with it (ADR-0045).
//
// THAT ARGUMENT DOES NOT LICENSE A THIRD COPY OF THE BOUNDS, and an earlier
// version of this block used it to (finding B-6). `@miolos/core` exports
// `termoTilesSchema`, `TERMO_MAX_GUESSES`, `TERMO_WORD_LENGTH` and
// `termoGuessWordSchema` from `contracts/termo-guess.ts` — client-safe by
// design, which is why `eslint.config.mjs` deliberately keeps them off
// `apps/web`'s ban list and why `termo/guess-client.ts` already imports from
// there — and this module imports from `@miolos/core` above regardless. So the
// wire contract and the record contract now read ONE definition of 6, of 5, of
// the tile enum and of the normalized-guess shape, and a fourth tile state
// cannot make them disagree silently in the field.
//
// ALL FOUR, not the three B-6 named: the guess regex was a fourth copy of the
// same fact under the same argument, left behind because the finding listed
// symbols rather than the rule (finding E-9).
//
// MEASURED, because `play-record.ts` is on every route's client graph and a
// gate is what the finding asked for. `pnpm build && pnpm bundle-check`, this
// branch, clean builds either side of the whole step-7 diff: `/`'s First Load
// JS moved 804.5 → 805.4 KB raw and 215.2 → 215.5 KB gzip, i.e. +0.9 KB raw
// for ALL of step 7 and well inside the ~2 KB the finding set as the point at
// which the local copies come back. It is cheap because the schemas were
// already in `/`'s graph: `completionRequestSchema` pulls
// `contracts/completion.ts`, which imports `termoGuessWordSchema` and
// `TERMO_MAX_GUESSES` from `contracts/termo-guess.ts` — this import adds a
// binding, not a module. `/termo` moved 873.7 → 874.3 KB raw over the same
// diff.

/**
 * The termo member (#27, ADR-0044). The first member that is NOT a board, and
 * the first whose `closed` and `solved` do not coincide.
 *
 * WHAT IT HOLDS: the JUDGED GUESS ROWS, and nothing in flight. A guess the
 * server has not answered lives in reducer state and never reaches storage —
 * a persisted unjudged row could never be filled in (the client has no answer
 * to judge against), so a reload would find a row with no tiles that had
 * already spent one of six attempts. Losing five typed letters to a crash is
 * strictly better.
 *
 * WHY THE TILES ARE STORED. `evaluateGuess(guess, answer)` needs the answer,
 * and termo's public projection is `game, date` only. Mid-play there is no
 * answer in scope, so a record without tiles cannot re-render the board after
 * a reload. This is not an optimisation.
 *
 * WHY `{guess, tiles}` ROWS AND NOT TWO PARALLEL ARRAYS. The paired shape is
 * structurally the engine's `EvaluatedGuess`, so `deriveKeyboardState(record
 * .guesses)` reads the record with no adapter. Parallel arrays need a length
 * cross-refine and let a hand-edited store desynchronise them.
 *
 * WHY THE GUESSES ARE NORMALIZED. It is the form every engine call already
 * sees, it is the form the wire carries so there is no conversion boundary,
 * and it is the ONLY form available: `content/termo/canonical-map.csv` is
 * harness input and does not ship, so there is no runtime way to obtain the
 * accented spelling of an arbitrary guess.
 *
 * `answer` is the ANSWER's canonical accented spelling (ADR-0015), written
 * only on the closing write. It is here rather than read off the completion
 * response because that response is a broken channel for it: `acceptResponse`
 * copies only `elapsedMs`/`hintsUsed`, and only on the `recorded: false`
 * branch (sync.ts), and the replay path returns before the wall read by
 * ADR-0026 decision 4's design. Without it, /termo/concluido cannot show the
 * word. `.length(5)` is what this schema can honestly prove: measured, all
 * 400 canonicals are exactly five codepoints and NFC-stable. A character
 * class here would be a second copy of the pt-BR alphabet, free to drift.
 *
 * `outcome` is STORED, not derived from the tiles, and the reason is blast
 * radius rather than bytes: `day-state.ts` reads this record to build the
 * hub's tiles and the conclusion's day card, and it must never import a game
 * engine (see the import note above). The derivation still has exactly one
 * definition — the Termo reducer's `restore` discards a record whose
 * `outcome` disagrees with `deriveBoardStatus(tiles)`, the same way
 * `nonogram/state.ts` discards a size mismatch. STORED ON THE RECORD is not
 * duplicated INTO THE STATE: `TermoPlayState` carries no `outcome` field — it
 * would be a second terminal predicate beside `PlayCore.status`, which
 * ADR-0029 consequence (e) forbids by name — so `buildRecord` writes this
 * field from `state.status` (`solved → "won"`, `lost → "lost"`), the
 * reducer's own `won → solved` mapping read backwards. A hand-edited
 * `outcome` therefore buys a wrong local tile and nothing else: it never
 * reaches the wire (`buildBody` posts the guess WORDS and lets the server
 * judge), and ADR-0031 decision 6 forbids this state from backing any streak
 * or medal (ADR-0044 consequence (f) states the consequence in full).
 *
 * `hintsUsed` keeps binairo's bound unchanged even though Termo ships no hint
 * (ADR-0045): one free hint per puzzle is a PRODUCT rule, not a per-game one,
 * and `.max(0)` would encode one ticket's decision into a product-level
 * bound. `buildRecord` writes the literal 0.
 *
 * THE SUPERREFINE IS NOT DECORATION. Two of its four checks guard documented
 * THROWS: `deriveBoardStatus` raises RangeError for more than MAX_GUESSES
 * rows and for any row following an all-correct row
 * (packages/games/src/termo/status.ts:25-36). A record violating either would
 * crash the reducer on restore, so it has to be UNPARSEABLE rather than
 * merely unexpected. The other two make the payload/`concluded` lockstep a
 * PARSE-TIME invariant rather than only a tested one —
 * `use-record-snapshot.ts` depends on it.
 *
 * A checked object is a legal `z.discriminatedUnion` option in Zod 4 and is
 * NOT one in Zod 3 — the same constraint the nonogram member carries,
 * verified against the installed zod 4.4.3.
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
          // accents — and THE WIRE'S OWN SCHEMA, not a local copy of its
          // regex. `termoGuessWordSchema` is byte-identically `/^[a-z]{5}$/`,
          // and a fourth copy of the same fact is what B-6 and E-9 removed.
          guess: termoGuessWordSchema,
          // THE WIRE'S OWN TUPLE, not a copy of it. It is the same `z.tuple`
          // shape zod 4.4.3 infers as a MUTABLE 5-tuple, so `buildRecord`'s
          // `[...row.tiles]` spread stays exactly as written and `T-WEB-S74`'s
          // mutual-assignability pin against the engine's union is unchanged.
          tiles: termoTilesSchema,
        }),
      )
      .max(TERMO_MAX_GUESSES),
    /** The canonical accented answer. Present IFF `concluded`. */
    answer: z.string().length(TERMO_WORD_LENGTH).optional(),
    /** Present IFF `concluded`. Never posted — the server judges. */
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

/**
 * The four dailies. `v` STAYS 1 across the whole union: the termo member is
 * purely ADDITIVE, so every binairo, sudoku and nonogram record written
 * before #27 parses identically after it (T-WEB-S74).
 */
export const playRecordSchema = z.discriminatedUnion("game", [
  binairoPlayRecordSchema,
  nonogramPlayRecordSchema,
  sudokuPlayRecordSchema,
  termoPlayRecordSchema,
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

/**
 * Whether a play record could EVER be read on this device (#34, step-6
 * blocker K3).
 *
 * `readPlayRecord` returning `undefined` is two different facts wearing one
 * answer: "not written yet", which resolves in a commit or two, and "this
 * browser has no store", which never resolves. Only the second one makes a
 * gated control permanently dead, and `storage()` is exactly the predicate
 * that separates them — Safari private mode and a site-data-blocked profile
 * both land in its `catch`.
 *
 * A RENDER-TIME CALL IS SAFE HERE, unlike `typeof navigator.share`: the only
 * caller renders behind `snapshot.hydrated`, which is `false` for the server
 * markup and for the hydrating client render both (`use-record-snapshot.ts`'s
 * constant server snapshot), so no branch on this value is ever part of a
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
 * 81-cell sudoku grid (plan 018 S17, landmine 3), nor yesterday's board into
 * today's screen.
 *
 * ONE predicate, three functions: this is the same
 * `playRecordKey(record.game, record.date) === key` test `listPendingRecords`
 * calls "the wall against the hand-edited store" and `prunePlayRecords`
 * deletes on. It used to check `game` alone, which left the READ path — the
 * one every rendering consumer goes through, `/…/concluido` included, and the
 * one route that does not prune — as the single door in this module that was
 * game-checked but not address-checked (step-6 round-3 finding
 * `readplayrecord-does-not-address-check-its-key`).
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
 *
 * Game-blind is not key-blind. A record must ADDRESS the key it was found
 * under, the same cross-check `readPlayRecord` above makes and for a sharper
 * reason: `sync.ts` settles a record with `writePlayRecord`, which derives
 * the key from the RECORD, so a record sitting at a key its own
 * `(game, date)` does not produce would be settled into a different key and
 * left pending at this one — re-POSTed on every mount, every `online`, every
 * `visibilitychange` and every rung of the retry ladder, forever, because a
 * pending record is never pruned by design (finding
 * `pending-queue-trusts-a-record-that-does-not-address-its-own-key`). No
 * product path can produce one (`buildRecord` takes `state.date` and
 * `writePlayRecord` derives the key), so this is the wall against the
 * hand-edited store the schema note at the top of this file names.
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

/**
 * How many SETTLED records dated before the mount's `keepDate` survive a
 * prune (#31, ADR-0053 decision 14).
 *
 * Fifty, from the same sentence the late-write ceiling comes from — a player
 * clearing a full week of all four games is 28 — so retention and the write
 * ceiling can never disagree about what a plausible session is.
 */
const RETAINED_PAST_RECORDS = 50;

/**
 * Keep the 50 most recent settled records dated before `keepDate`, and drop
 * the rest. `keepDate` is the SERVER's date (ADR-0010's single authority),
 * never a client-computed today — pruning on a wrong clock would delete a
 * queue that was about to flush. A pending record is kept forever by design:
 * it is the only copy of a completion the server has not acknowledged.
 *
 * **The retention is #31's, and without it the archive has no permanent
 * result URL** (ADR-0053 decision 14). This runs on EVERY play mount with
 * that mount's date, and every archive record is dated before today **by
 * construction** — so, before the cap, the moment an archive completion
 * settled and the player reached any daily route the result was deleted. Not
 * "on a later day": on the next navigation, in the same session. Browsing the
 * archive forward self-destructed the same way, because the second mount's
 * `keepDate` is the newer date.
 *
 * **The ordering key is `record.date`, because it is the only orderable field
 * the record has** — the schema carries no written-at timestamp, and adding
 * one is a versioned-schema decision this ticket has no business making. The
 * record key breaks ties so the order is total and this function stays
 * deterministic. The consequence is stated rather than hidden: a player
 * already holding 50 settled archive records who then solves a date older
 * than all of them loses that result on the next prune, and ADR-0053 decision
 * 10 layer 3 is what covers that case.
 *
 * **Two honest bounds.** A pending record is never pruned, so a player past
 * the daily write ceiling holds 50 settled records PLUS their pending tail
 * until the next rollover flush. And the cap applies per mount date, so
 * browsing newest-to-oldest lets records accumulate until the next daily
 * mount re-applies it over everything: "bounded" means bounded at the next
 * daily mount, self-healing rather than instantaneous.
 *
 * It stays behaviour-neutral for every daily surface, because today's record
 * is never a prune candidate (`record.date < keepDate` is false for it).
 *
 * The ONE unconditional drop is a record that does not address its own key.
 * It is unsyncable by construction (see `listPendingRecords` above), so
 * keeping it forever keeps nothing; it goes whatever its `pendingSync` and
 * whatever its date. Unparseable keys are still left alone — this function
 * owns the play namespace's records, not its garbage.
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
