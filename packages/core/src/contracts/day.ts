import { z } from "zod";

import { dayGameStatusSchema } from "../day";
import { isoDateString } from "./daily";

/**
 * Body of GET /day — the server day-truth payload ADR-0031 decision 5
 * promised, ADR-0048 deferred to #83, and ADR-0060 defines.
 *
 * IT ARRIVES AS ITS OWN ENDPOINT AND ITS OWN CONTRACT, which is not a
 * preference: `streakResponseSchema` and `statsResponseSchema` are strict on
 * BOTH ends (the route parses before `Response.json`, the web client parses
 * what it receives), so an appended field on either would fail every
 * deployed client's parse. `contracts/streak.ts`'s header says so in as many
 * words, and this file is the fulfilment of that sentence.
 *
 * `date` is `isoDateString`, not `calendarDateString`: server-derived, and
 * it feeds string EQUALITY only — the client discards the whole payload
 * unless this value equals the day it is rendering (ADR-0060 decision 3).
 * That is the `statsResponseSchema.date` convention, for the same reason.
 *
 * NESTED `games` RATHER THAN FLAT PER-GAME KEYS, diverging from
 * `statsResponseSchema`'s flat shape with a reason. `/stats`'s four per-game
 * values are HETEROGENEOUS (`timedGameStatsSchema` × 3 + `termoStatsSchema`)
 * and interleaved with two scalars, so `Record<Game, X>` does not exist in
 * that payload at any shape and flat is the only honest spelling there.
 * `/day`'s four are HOMOGENEOUS, so `DayResponse["games"]` IS
 * `Record<Game, DayGameStatus>` by construction — literally `mergeDayState`'s
 * input type, typed without a cast or a helper. The two shapes differ
 * because the payloads differ, not because one of them drifted. Total over
 * the four games, one key each, so a dropped key does not compile.
 *
 * WHAT IT DOES NOT CARRY, and each absence is a decision (ADR-0060 decision
 * 2):
 *
 * - no puzzle content of any kind — no id, no answer, no board — and no
 *   date but the server's own today. The route takes NO parameters, so
 *   there is no way to ask about tomorrow (ADR-0004);
 * - no streak: `/streak` owns it and this payload never derives it;
 * - no `elapsedMs` and no guess count. Solve times are a `/stats` concern
 *   (ADR-0051 decision 4) and `todayTermoGuesses` already exists on
 *   `statsResponseSchema` — carrying it here would be a SECOND PRODUCER of
 *   one value, so ADR-0051 decision 3's hub-endpoint trigger stands;
 * - NO `onTime` FIELD, because nothing consumes it: the on-time rule is
 *   applied server-side and only its verdict travels, as one of the three
 *   verbs. The tempting warrant *"on-time never rides a wire contract"* is
 *   FALSE and must not be written here — `completionResponseSchema` carries
 *   `onTime: z.boolean()` as the write path's receipt, and ADR-0051 decision
 *   1's sentence is about the stats ADR's own payloads.
 */
export const dayResponseSchema = z.strictObject({
  /** The DB clock's SP today (ADR-0010), never a client-computed day. */
  date: isoDateString,
  games: z.strictObject({
    termo: dayGameStatusSchema,
    sudoku: dayGameStatusSchema,
    nonogram: dayGameStatusSchema,
    binairo: dayGameStatusSchema,
  }),
});

export type DayResponse = z.infer<typeof dayResponseSchema>;
