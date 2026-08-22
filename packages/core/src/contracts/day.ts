import { z } from "zod";

import { dayGameStateSchema } from "../day";
import { isoDateString } from "./daily";

/**
 * Body of GET /day — the server day-truth payload (ADR-0060): today's status
 * for all four games, no puzzle content, no streak, no `onTime` field.
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
