import { z } from "zod";

import { calendarDateString, isoDateString } from "./daily";

const statCount = z.number().int().min(0);

export const timedGameStatsSchema = z.strictObject({
  solved: statCount,
  bestMs: z.number().int().min(0).nullable(),
  averageMs: z.number().int().min(0).nullable(),
  averageSampleCount: statCount,
  histogram: z.tuple([
    statCount,
    statCount,
    statCount,
    statCount,
    statCount,
    statCount,
  ]),
});

export const termoStatsSchema = z.strictObject({
  solved: statCount,
  distribution: z.tuple([
    statCount,
    statCount,
    statCount,
    statCount,
    statCount,
    statCount,
    statCount,
  ]),
});

/** Body of GET /stats. Strict on both ends (ADR-0048 decision 3): growth is a
 *  NEW endpoint — #30's medals arrive on their own contract, never here. */
export const statsResponseSchema = z.strictObject({
  // The DB clock's SP day the summary was computed against. `isoDateString`
  // (shape only) is deliberate and asymmetric with the calendar's
  // `calendarDateString` below: this value feeds only string EQUALITY
  // checks (the hub tile's and the conclusion's day-match gates), never a
  // date parser — the repo convention for server-derived comparands.
  date: isoDateString,
  binairo: timedGameStatsSchema,
  sudoku: timedGameStatsSchema,
  nonogram: timedGameStatsSchema,
  termo: termoStatsSchema, // structurally time-free (ADR-0045 decision 4)
  perfectDays: statCount,
  todayTermoGuesses: z.number().int().min(1).max(6).nullable(),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const calendarDayStateSchema = z.enum(["onTime", "late", "missed"]);

/** Body of GET /stats/calendar. Full enumeration, one entry per day of
 *  [effectiveSince, today] — the client renders, never derives (D3).
 *  NO envelope fields: the range start IS days[0].date and the range end IS
 *  days.at(-1)!.date (`since <= today` holds by construction — both come off
 *  the same DB clock — so the enumeration is never empty; min(1) makes an
 *  impossible empty answer a parse failure, i.e. the catch-all 500, not a
 *  silent lie). A `date`/`since` pair here would be bytes derivable from the
 *  payload on a contract closed to change — the speculative surface this
 *  repo treats as a finding. */
export const statsCalendarResponseSchema = z.strictObject({
  days: z
    .array(
      z.strictObject({
        // A calendar-VALID day, not just the shape: these values go into
        // throwing parsers on the client (`epochDay` in the month-grid
        // helper, `Intl` formatters), so a malformed 200 must fail the
        // `safeParse` — the honest settled-null zero — instead of throwing
        // a `RangeError` mid-render.
        date: calendarDateString,
        state: calendarDayStateSchema,
        perfect: z.boolean(),
      }),
    )
    .min(1),
});
export type StatsCalendarResponse = z.infer<typeof statsCalendarResponseSchema>;
