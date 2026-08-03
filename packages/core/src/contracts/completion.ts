import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import {
  calendarDateString,
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
} from "./daily";
// One direction only (plan 022 §8.0): `./termo-guess.ts` must never import
// from this module, or the two close a cycle that throws at import in every
// `@miolos/core` consumer — and `pnpm test` does not catch it.
import { TERMO_MAX_GUESSES, termoGuessWordSchema } from "./termo-guess";

/** A submitted board is COMPLETE — `null` is a partial grid, never a completion. */
const submittedCellSchema = z.union([z.literal(0), z.literal(1)]);

/**
 * Completion submission (ADR-0008, ADR-0026). Deliberately carries NO
 * timestamp: `completed_at` is the DB clock at insert, and accepting a
 * client instant would put the client clock into streak arithmetic
 * (CLAUDE.md invariant). `elapsedMs`/`hintsUsed` are statistics,
 * range-checked here so an untrusted body can never widen a column — the
 * CLIENT clamps before posting (plan 017 §9.2), so a legitimate long
 * session is never rejected by this bound.
 *
 * `hintsUsed` maxes at 1 because v1 grants exactly one free hint per
 * puzzle (plan 017 D21). The rewarded-ad ticket widens it together with
 * the consumption record ADR-0027 names.
 *
 * Strict, deliberately: a smuggled key fails the parse rather than being
 * silently dropped, which is what makes the no-timestamp guarantee above
 * structural instead of conventional.
 *
 * ONE KEY IS AN EXCEPTION, and it is recorded rather than left to be
 * rediscovered (step-6 round-4 finding
 * `strictobject-silently-drops-a-json-proto-key`). `JSON.parse` puts
 * `__proto__` on the object as an OWN enumerable property, but Zod's
 * unrecognized-key check asks `"__proto__" in shape` — true for every object
 * literal — so a body carrying it PARSES and the key is silently dropped
 * instead of rejected. It is harmless and the no-timestamp guarantee still
 * holds, but for a different reason than the sentence above gives: the parsed
 * value is a fresh object carrying only the declared keys, so no client value
 * survives and no prototype pollution occurs — verified end to end through the
 * real route. Every OTHER smuggled key, `constructor` included, is rejected.
 * `T-CORE-S16` pins both halves so a Zod bump that changes either goes red.
 *
 * EXTENSION POINT, CLOSED AT #27: `termoCompletionRequestSchema` is the
 * fourth member and the union now covers every M2 game. The discriminator is
 * still `game`, and a fifth game attaches the same way — by adding a member
 * here, never by loosening one.
 */
export const binairoCompletionRequestSchema = z.strictObject({
  game: z.literal("binairo"),
  date: calendarDateString,
  grid: z.array(submittedCellSchema).length(64),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type BinairoCompletionRequest = z.infer<
  typeof binairoCompletionRequestSchema
>;

/**
 * A submitted sudoku is COMPLETE — `0` means "empty" in `SudokuGrid`, so
 * it is excluded here for exactly the reason `null` is excluded from
 * binairo's. `sudokuDigitSchema` is imported from `./daily`, never
 * re-declared (plan 018 §6.1/C6).
 *
 * `elapsedMs`/`hintsUsed` carry binairo's bounds unchanged and must stay
 * identical — one free hint per puzzle is a product rule, not a per-game
 * one. `date` is `calendarDateString`, never `isoDateString`: it is
 * client-supplied.
 *
 * The two `grid` members do NOT generalize into `z.array(z.number())`:
 * that would let a binairo client post a `7` and a sudoku client post a
 * `0`, destroying the "a submission is a COMPLETE grid" invariant both
 * schemas exist to enforce.
 */
export const sudokuCompletionRequestSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: calendarDateString,
  grid: z.array(sudokuDigitSchema).length(81),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type SudokuCompletionRequest = z.infer<
  typeof sudokuCompletionRequestSchema
>;

/**
 * The four legal board areas — 5², 8², 10², 15²
 * (packages/games/src/nonogram/difficulty.ts:31-41). A nonogram is the first
 * game whose board size changes daily, so the fixed `.length(64)`/`.length(81)`
 * that proves "this submission is a COMPLETE board" for the other two is
 * unavailable; the legal SET is the contract.
 *
 * DERIVED, never hand-written: `nonogramSizeSchema` is "ONE definition, three
 * consumers" (contracts/daily.ts), and a second literal list in the same
 * package would be a fourth definition of the same fact, free to drift the
 * day a fifth size class lands. Verified against the installed zod 4.4.3 that
 * a `z.union` of literals exposes `.options` and each option its `.value`:
 * `[5, 8, 10, 15] -> [25, 64, 100, 225]`.
 *
 * Deliberately NOT a `size` key plus a cross-check (plan 020 P4): `size`
 * would be a second place for the client to lie, would make this the only
 * union member with six keys (breaking the audited five-field tripwire in
 * completion-contract.test.ts), and would still not be authoritative — the
 * STORED row's solution decides the size, and the route checks the submitted
 * length against it before comparing a single cell.
 */
const NONOGRAM_CELL_COUNTS: readonly number[] = nonogramSizeSchema.options.map(
  (option) => option.value ** 2,
);

/**
 * A submitted nonogram is the PICTURE BITMAP: 1 where the cell is filled,
 * 0 everywhere else. A player may finish having crossed every empty cell,
 * having crossed none, or any mixture — a cross is a client-side annotation
 * that never crosses the wire, so all three finishes produce the IDENTICAL
 * body (ADR-0032). `submittedCellSchema` is binairo's, reused: the "COMPLETE
 * grid" invariant is the same one.
 *
 * The three `grid` members do NOT generalize into `z.array(z.number())`
 * (:70-73) and the nonogram member does not generalize the other two: a
 * length-free array would let a binairo client post 225 cells and a nonogram
 * client post 63.
 *
 * THIS is the genuinely untrusted array, named here rather than left
 * implicit: the play record's `entries` come off the player's own
 * `localStorage`, but this `grid` is what an anonymous client POSTs. The
 * `.refine` below runs AFTER zod has parsed every element — measured against
 * the installed 4.4.3, `{success:false, ms:35, elementChecksRun:1000000}` on
 * a 10^6-element array — so a length constraint is a REJECTION rule, never an
 * allocation bound. That is the identical exposure the shipped
 * `.length(64)`/`.length(81)` members already carry, so nothing regresses
 * with this member. If the exposure is ever worth closing it is closed once,
 * for all three members, upstream of the route — not by a per-game refine.
 */
export const nonogramCompletionRequestSchema = z.strictObject({
  game: z.literal("nonogram"),
  date: calendarDateString,
  grid: z
    .array(submittedCellSchema)
    .refine((g) => NONOGRAM_CELL_COUNTS.includes(g.length), {
      message: "grid length must be 25, 64, 100 or 225",
    }),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type NonogramCompletionRequest = z.infer<
  typeof nonogramCompletionRequestSchema
>;

/**
 * Termo's completion (#27, ADR-0038). FIVE keys, like every other member —
 * `guesses` sits exactly where the three grid members carry `grid`.
 *
 * It carries the guess LIST and nothing else, because the list is the only
 * EVIDENCE of the outcome that exists. A `won`/`lost` field would be a
 * client-asserted outcome, the same class of input as the client-supplied
 * completion instant ADR-0026 rejects outright; a `tiles` field would be a
 * second place to lie about a fact the stored row owns, which is the argument
 * that kept `size` off the nonogram member above. The server recomputes both
 * from `guesses` and the stored answer.
 *
 * It does NOT achieve ADR-0032's byte-identity between two honest winners —
 * two players who won on guess 4 guessed different words, and there is no
 * smaller canonical form that PROVES a win. What it keeps is ADR-0032's
 * substance: no leniency rule, no client-asserted outcome, no second place to
 * lie. Byte-identity survives where it can — the wire is normalized, so
 * "AÇÃO" and "acao" are the same bytes. The warrant for the extra state is
 * that the guess SEQUENCE is itself outcome-bearing: ADR-0008 requires the
 * fail row, and the statistics ticket's distribution is a function of the
 * guess count.
 *
 * `elapsedMs`/`hintsUsed` carry binairo's bounds unchanged and must stay
 * identical. `hintsUsed` keeps `.max(1)` even though Termo ships no hint
 * (ADR-0045): the bound is a PRODUCT rule, not a per-game one, and narrowing
 * it to `z.literal(0)` would make a later hint a contract change.
 */
export const termoCompletionRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type TermoCompletionRequest = z.infer<
  typeof termoCompletionRequestSchema
>;

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  nonogramCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  termoCompletionRequestSchema,
]);

export type CompletionRequest = z.infer<typeof completionRequestSchema>;

/**
 * Body of POST /completions. Carries the STORED row, never the request
 * echoed back — a replay returns 200 with the values the server already
 * holds (plan 017 D15), so the client's record converges on the server's.
 *
 * `date` is `isoDateString`, not `calendarDateString`: this value is
 * server-derived from a row that only exists because the day was real.
 *
 * Strict: the route reads the stored solution to judge the grid, so the
 * response shape is the last place a solution could leak (ADR-0004).
 */
export const completionResponseSchema = z.strictObject({
  game: gameSchema,
  date: isoDateString,
  outcome: completionOutcomeSchema,
  /** Derived server-side from the completion instant vs the puzzle's SP day. */
  onTime: z.boolean(),
  /** false = the row already existed; the body carries the STORED values. */
  recorded: z.boolean(),
  elapsedMs: z.number().int().min(0),
  hintsUsed: z.number().int().min(0),
});

export type CompletionResponse = z.infer<typeof completionResponseSchema>;

/**
 * Minimal error envelope — the repo's first; keep it this small. The
 * `error` value is a stable machine token (`no-session`, `grid-mismatch`,
 * …) that the offline queue branches on (plan 017 §9.2), never prose and
 * never pt-BR copy: user-facing strings live in the web app's i18n module.
 */
export const apiErrorResponseSchema = z.strictObject({ error: z.string() });

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
