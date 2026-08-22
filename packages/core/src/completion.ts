import { z } from "zod";

/**
 * How a daily ended for a player (ADR-0008). One list feeds the drizzle
 * enum, the Zod contracts and the DB CHECK constraint, so the three can
 * never drift apart.
 *
 * `lost` applies to Termo only: for the grid games a wrong board is not an
 * outcome at all, it is a client bug or tampering, and the route rejects it
 * with 422 rather than recording a loss.
 */
export const COMPLETION_OUTCOMES = ["won", "lost"] as const;

export type CompletionOutcome = (typeof COMPLETION_OUTCOMES)[number];

export const completionOutcomeSchema = z.enum(COMPLETION_OUTCOMES);

/**
 * Where a day-scoped hint grant came from (ADR-0006, ADR-0027). Dormant in
 * v1 — no ads SDK ships, so nothing writes a grant row. The v1 free hint is
 * NOT a source here: it is per-puzzle, grants nothing, and is recorded on
 * `completions.hints_used` — a source that read like a purchase or balance
 * top-up would be the ADR-0006 violation this list exists to make visible.
 */
export const HINT_GRANT_SOURCES = ["rewarded-ad"] as const;

export type HintGrantSource = (typeof HINT_GRANT_SOURCES)[number];

export const hintGrantSourceSchema = z.enum(HINT_GRANT_SOURCES);
