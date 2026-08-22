import { z } from "zod";

import { isoDateString } from "./daily";

/**
 * Body of GET /streak — the caller's streak as of the DB clock's SP today
 * (ADR-0048). Carries no per-game day state; that lives in `dayResponseSchema`
 * (`./day.ts`) behind its own endpoint.
 *
 * Strict on both ends — the route parses before `Response.json`, the web
 * client parses what it receives — so growth must arrive as a new endpoint
 * and contract, never an appended field: that would fail every deployed
 * client's parse. Other contracts in this directory cite this as "the
 * streak.ts register".
 */
export const streakResponseSchema = z.strictObject({
  /** The DB clock's SP date the value was computed against (ADR-0010). */
  date: isoDateString,
  streak: z.number().int().min(0),
  /**
   * Whether `date` itself is a counted streak day — drives the conclusion
   * card's "mantida por hoje." tail (ADR-0048 decision 2): the streak may
   * be alive through yesterday while today did not maintain it.
   */
  todayCounts: z.boolean(),
});

export type StreakResponse = z.infer<typeof streakResponseSchema>;
