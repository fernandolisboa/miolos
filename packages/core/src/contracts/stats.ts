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

export const statsResponseSchema = z.strictObject({
  date: isoDateString,
  binairo: timedGameStatsSchema,
  sudoku: timedGameStatsSchema,
  nonogram: timedGameStatsSchema,
  termo: termoStatsSchema,
  perfectDays: statCount,
  todayTermoGuesses: z.number().int().min(1).max(6).nullable(),
});
export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const calendarDayStateSchema = z.enum(["onTime", "late", "missed"]);

export const statsCalendarResponseSchema = z.strictObject({
  days: z
    .array(
      z.strictObject({
        date: calendarDateString,
        state: calendarDayStateSchema,
        perfect: z.boolean(),
      }),
    )
    .min(1),
});
export type StatsCalendarResponse = z.infer<typeof statsCalendarResponseSchema>;
