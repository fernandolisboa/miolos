import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import {
  calendarDateString,
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
} from "./daily";
// One direction only: this module imports from `./termo-guess`, never the
// reverse — a cycle here throws at import in every `@miolos/core` consumer,
// and `pnpm test` does not catch it.
import { TERMO_MAX_GUESSES, termoGuessWordSchema } from "./termo-guess";

/** A submitted board is COMPLETE — `null` is a partial grid, never a completion. */
const submittedCellSchema = z.union([z.literal(0), z.literal(1)]);

/**
 * Completion submission (ADR-0008, ADR-0026). Carries no timestamp:
 * `completed_at` is the DB clock at insert, never a client instant.
 * `hintsUsed` maxes at 1 — v1 grants exactly one free hint per puzzle.
 * Strict: an unrecognized key fails the parse rather than being silently
 * dropped.
 *
 * One key is an exception: `JSON.parse` puts `__proto__` on the object as
 * an own enumerable property, and Zod's unrecognized-key check asks
 * `"__proto__" in shape` — true for every object literal — so a body
 * carrying it parses and the key is silently dropped rather than rejected.
 * This is harmless: the parsed value is a fresh object carrying only the
 * declared keys, so no client value survives and no prototype pollution
 * occurs. Every other smuggled key, `constructor` included, is rejected.
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
 * A submitted sudoku is COMPLETE — `0` means "empty" in `SudokuGrid`, so it
 * is excluded here for the same reason `null` is excluded from binairo's.
 *
 * The two `grid` members do NOT generalize into `z.array(z.number())`:
 * that would let a binairo client post a `7` and a sudoku client post a
 * `0`, destroying the "a submission is a complete grid" invariant both
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

/** The four legal board areas — 5², 8², 10², 15² — derived from
 *  `nonogramSizeSchema` rather than hand-written, so they cannot drift. */
const NONOGRAM_CELL_COUNTS: readonly number[] = nonogramSizeSchema.options.map(
  (option) => option.value ** 2,
);

/**
 * A submitted nonogram is the PICTURE BITMAP: 1 where filled, 0 elsewhere —
 * a cross is a client-side annotation that never crosses the wire, so every
 * finish produces the identical body (ADR-0032).
 *
 * Length-free, unlike binairo/sudoku's fixed `.length()`, because the board
 * size varies daily. The `.refine` below checks length AFTER Zod has parsed
 * every element, so it is a rejection rule, not an allocation bound — the
 * same exposure the shipped `.length(64)`/`.length(81)` members already
 * carry. If that is ever worth closing, close it once for all three members
 * upstream of the route, never by a per-game refine.
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
 * Termo's completion (ADR-0038). Carries the guess list and nothing else —
 * a `won`/`lost` field would be a client-asserted outcome, and a `tiles`
 * field would be a second place to lie about a fact the stored row owns.
 * The server recomputes both from `guesses` and the stored answer.
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
 * holds, so the client's record converges on the server's.
 *
 * `date` is `isoDateString`, not `calendarDateString`: this value is
 * server-derived from a row that only exists because the day was real.
 *
 * Strict: the response is the last place a solution could leak (ADR-0004).
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
 * Minimal error envelope. `error` is a stable machine token (`no-session`,
 * `grid-mismatch`, …) that the client branches on — never prose, never
 * pt-BR copy: user-facing strings live in the web app's i18n module.
 */
export const apiErrorResponseSchema = z.strictObject({ error: z.string() });

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
