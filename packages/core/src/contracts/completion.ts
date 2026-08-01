import { z } from "zod";

import { completionOutcomeSchema } from "../completion";
import { gameSchema } from "../game";
import { isoDateString, sudokuDigitSchema } from "./daily";

/**
 * A calendar-VALID 'YYYY-MM-DD'. `isoDateString` checks shape only, which
 * is right for server-derived values but not for a client-supplied one:
 * "2026-02-30" passes the regex, reaches `eq(dailyPuzzles.date, date)`
 * against a Postgres `date` column, and raises 22008 — a 500 from a
 * two-character body edit. Round-tripping through UTC is the check: JS
 * rolls an impossible day over ("2026-02-30" ⇒ 2026-03-02), so a value
 * that survives the round trip is a real day on the calendar.
 */
export const calendarDateString = isoDateString.refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}, "not a calendar date");

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
 * EXTENSION POINT: #25/#27 add their variants to the union; the
 * discriminator is `game`.
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

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  sudokuCompletionRequestSchema,
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
