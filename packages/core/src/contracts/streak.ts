import { z } from "zod";

import { isoDateString } from "./daily";

/**
 * Body of GET /streak — the repo's first authenticated read (ADR-0048).
 * One question, one answer: the caller's streak as of the DB clock's SP
 * today. No per-game day state rides here: ADR-0048 amended ADR-0031
 * decision 5 to defer the server day-truth payload to its own issue, and
 * because this schema is strict ON BOTH ENDS (the route parses before
 * `Response.json`, the web client parses what it receives), that payload had
 * to arrive as a new endpoint and contract — an appended field would fail
 * every deployed client's parse.
 *
 * IT DID, at #83: `dayResponseSchema` in `./day.ts`, behind `GET /day`
 * (ADR-0060 decision 1). The sentence above was the prediction; this one is
 * its discharge, and the rule it states still binds in both directions —
 * `/day`'s own growth is a THIRD endpoint, never a field here or there.
 *
 * `date` is `isoDateString`, not `calendarDateString`: server-derived
 * (the `completionResponseSchema` precedent).
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
