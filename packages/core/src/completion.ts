import { z } from "zod";

export const COMPLETION_OUTCOMES = ["won", "lost"] as const;

export type CompletionOutcome = (typeof COMPLETION_OUTCOMES)[number];

export const completionOutcomeSchema = z.enum(COMPLETION_OUTCOMES);

export const HINT_GRANT_SOURCES = ["rewarded-ad"] as const;

export type HintGrantSource = (typeof HINT_GRANT_SOURCES)[number];

export const hintGrantSourceSchema = z.enum(HINT_GRANT_SOURCES);

export const FREE_HINTS_PER_PUZZLE = 3;

export const hintsUsedSchema = z
  .number()
  .int()
  .min(0)
  .max(FREE_HINTS_PER_PUZZLE);
