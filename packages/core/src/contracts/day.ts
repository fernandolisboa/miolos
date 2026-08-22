import { z } from "zod";

import { dayGameStateSchema } from "../day";
import { isoDateString } from "./daily";

/**
 * Body of GET /day — the server day-truth payload (ADR-0060): today's status
 * for all four games, no streak, no `onTime` field, and no *playable* puzzle
 * content.
 *
 * "No content of any kind" would be wrong, and was narrowed rather than left
 * standing: a completed Nonogram claim carries `motifName`, which IS curated
 * daily content (ADR-0070; ADR-0060 annotation (i)). It does not breach
 * ADR-0004 because the claim projects the user's own completion rows, so the
 * name cannot reach a payload before the server judged that user's day — the
 * register is product, not confidentiality. No id, no `mirrored`, no solution.
 *
 * The route takes NO parameters, so there is no way to ask about tomorrow.
 */
export const dayResponseSchema = z.strictObject({
  /** The DB clock's SP today (ADR-0010), never a client-computed day. */
  date: isoDateString,
  games: z.strictObject({
    termo: dayGameStateSchema,
    sudoku: dayGameStateSchema,
    nonogram: dayGameStateSchema,
    binairo: dayGameStateSchema,
  }),
});

export type DayResponse = z.infer<typeof dayResponseSchema>;
