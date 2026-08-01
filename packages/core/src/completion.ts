import { z } from "zod";

/**
 * How a daily ended for a player (ADR-0008). One list feeds the drizzle
 * enum, the Zod contracts and the CHECK constraint, so the three can never
 * drift apart (plan 017 §6.2).
 *
 * `lost` exists from day one even though M1 can never write it: Termo is
 * the only game that ends without a solve, so #27 attaches to this
 * vocabulary rather than migrating the column. For the grid games a wrong
 * board is not an outcome at all — it is a client bug or tampering, and
 * the route rejects it with 422 rather than recording a loss (plan 017
 * §7.3 step 7).
 */
export const COMPLETION_OUTCOMES = ["won", "lost"] as const;

export type CompletionOutcome = (typeof COMPLETION_OUTCOMES)[number];

export const completionOutcomeSchema = z.enum(COMPLETION_OUTCOMES);

/**
 * Where a day-scoped hint grant came from (ADR-0006, ADR-0027).
 *
 * DORMANT in v1: no ads SDK ships (CLAUDE.md), so nothing writes a grant
 * row and this list has exactly one member. The vocabulary exists now so
 * the rewarded-ad ticket attaches to the shipped schema instead of
 * migrating it.
 *
 * The v1 free hint is NOT a source here: it is per-puzzle, grants nothing
 * and is recorded on `completions.hints_used` (plan 017 D21). A source
 * that reads like a purchase or a balance top-up would be the ADR-0006
 * violation this list exists to make visible.
 */
export const HINT_GRANT_SOURCES = ["rewarded-ad"] as const;

export type HintGrantSource = (typeof HINT_GRANT_SOURCES)[number];

export const hintGrantSourceSchema = z.enum(HINT_GRANT_SOURCES);
