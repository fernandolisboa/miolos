import { describe, expect, it } from "vitest";

import {
  statsCalendarResponseSchema,
  statsResponseSchema,
  type StatsCalendarResponse,
  type StatsResponse,
} from "../src/index";

const timedZero: StatsResponse["binairo"] = {
  solved: 0,
  bestMs: null,
  averageMs: null,
  averageSampleCount: 0,
  histogram: [0, 0, 0, 0, 0, 0],
};

const validStats: StatsResponse = {
  date: "2026-08-13",
  binairo: {
    solved: 5,
    bestMs: 50_000,
    averageMs: 200_000,
    averageSampleCount: 2,
    histogram: [2, 0, 1, 0, 1, 0],
  },
  sudoku: timedZero,
  nonogram: timedZero,
  termo: { solved: 5, distribution: [1, 0, 0, 2, 0, 0, 2] },
  perfectDays: 1,
  todayTermoGuesses: 4,
};

const validCalendar: StatsCalendarResponse = {
  days: [
    { date: "2026-08-12", state: "onTime", perfect: true },
    { date: "2026-08-13", state: "missed", perfect: false },
  ],
};

describe("statsResponseSchema / statsCalendarResponseSchema (plan 033 §3.3)", () => {
  it("T-CORE-S69: both schemas are strict, tuple lengths 6/7 exact, enums closed, ranges enforced, the calendar envelope-free and never empty", () => {
    expect(statsResponseSchema.parse(validStats)).toEqual(validStats);
    expect(statsCalendarResponseSchema.parse(validCalendar)).toEqual(
      validCalendar,
    );

    expect(
      statsResponseSchema.safeParse({ ...validStats, medals: [] }).success,
    ).toBe(false);
    expect(
      statsResponseSchema.safeParse({
        ...validStats,
        binairo: { ...validStats.binairo, worstMs: 1 },
      }).success,
    ).toBe(false);
    expect(
      statsResponseSchema.safeParse({
        ...validStats,
        termo: { ...validStats.termo, averageMs: 1 },
      }).success,
    ).toBe(false);

    for (const histogram of [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ]) {
      expect(
        statsResponseSchema.safeParse({
          ...validStats,
          sudoku: { ...timedZero, histogram },
        }).success,
      ).toBe(false);
    }
    for (const distribution of [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ]) {
      expect(
        statsResponseSchema.safeParse({
          ...validStats,
          termo: { solved: 0, distribution },
        }).success,
      ).toBe(false);
    }

    const withoutSampleCount = {
      solved: timedZero.solved,
      bestMs: timedZero.bestMs,
      averageMs: timedZero.averageMs,
      histogram: timedZero.histogram,
    };
    expect(
      statsResponseSchema.safeParse({
        ...validStats,
        sudoku: withoutSampleCount,
      }).success,
    ).toBe(false);

    expect(
      statsResponseSchema.safeParse({ ...validStats, todayTermoGuesses: null })
        .success,
    ).toBe(true);
    for (const guesses of [0, 7, 3.5]) {
      expect(
        statsResponseSchema.safeParse({
          ...validStats,
          todayTermoGuesses: guesses,
        }).success,
      ).toBe(false);
    }

    expect(
      statsCalendarResponseSchema.safeParse({
        days: [{ date: "2026-08-13", state: "pending", perfect: false }],
      }).success,
    ).toBe(false);

    expect(
      statsCalendarResponseSchema.safeParse({
        ...validCalendar,
        date: "2026-08-13",
      }).success,
    ).toBe(false);
    expect(
      statsCalendarResponseSchema.safeParse({
        ...validCalendar,
        since: "2026-08-12",
      }).success,
    ).toBe(false);

    expect(statsCalendarResponseSchema.safeParse({ days: [] }).success).toBe(
      false,
    );
  });

  it("T-CORE-S69a: a calendar day must be a real day — a shape-valid non-day fails the parse instead of reaching a throwing parser", () => {
    for (const date of ["0000-00-00", "0000-01-01", "2026-02-30"]) {
      expect(
        statsCalendarResponseSchema.safeParse({
          days: [{ date, state: "missed", perfect: false }],
        }).success,
      ).toBe(false);
    }

    expect(
      statsResponseSchema.safeParse({ ...validStats, date: "0000-00-00" })
        .success,
    ).toBe(true);
  });
});
