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

/** Body of GET /stats. Strict on both ends: growth is a new endpoint —
 *  medals arrive on their own contract, never here. */
export const statsResponseSchema = z.strictObject({
  // The DB clock's SP day the summary was computed against. `isoDateString`
  // (shape only) is deliberate here: this value feeds only string equality
  // checks (day-match gates), never a date parser.
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
 *  [effectiveSince, today] — the client renders, never derives. No envelope
 *  fields: the range start is `days[0].date` and the range end is
 *  `days.at(-1)!.date`, so the enumeration is never empty; `.min(1)` makes
 *  an impossible empty answer a parse failure rather than a silent lie. */
export const statsCalendarResponseSchema = z.strictObject({
  days: z
    .array(
      z.strictObject({
        // A calendar-VALID day, not just the shape: these values go into
        // throwing parsers on the client (`epochDay`, `Intl` formatters),
        // so a malformed 200 must fail the `safeParse` instead of throwing
        // mid-render.
        date: calendarDateString,
        state: calendarDayStateSchema,
        perfect: z.boolean(),
      }),
    )
    .min(1),
});
export type StatsCalendarResponse = z.infer<typeof statsCalendarResponseSchema>;
