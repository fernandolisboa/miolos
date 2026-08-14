import { describe, expect, it } from "vitest";

import {
  statsCalendarResponseSchema,
  statsResponseSchema,
  type StatsCalendarResponse,
  type StatsResponse,
} from "../src/index";

/**
 * The two #29 wire contracts (plan 033 §3.3, ADR-0048 decision 3): strict
 * on both ends, closed to growth the moment they ship. These fixtures pin
 * the closures — an unknown key, a wrong tuple length, an out-of-range
 * value or an envelope field must FAIL the parse, because a parse failure
 * at the route is the catch-all 500, never a silent lie on the wire.
 */

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
    // Round trips.
    expect(statsResponseSchema.parse(validStats)).toEqual(validStats);
    expect(statsCalendarResponseSchema.parse(validCalendar)).toEqual(
      validCalendar,
    );

    // Strict at every level: an unknown key is a parse failure — growth is
    // a NEW endpoint (#30's medals never land here).
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

    // Tuple lengths are exact: 6 histogram buckets, 7 distribution rows.
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

    // `averageSampleCount` is load-bearing (the closing line's gate): a
    // payload without it fails.
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

    // todayTermoGuesses is 1..6 or null — never 0, never 7.
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

    // The day-state enum is closed.
    expect(
      statsCalendarResponseSchema.safeParse({
        days: [{ date: "2026-08-13", state: "pending", perfect: false }],
      }).success,
    ).toBe(false);

    // NO envelope fields: the range start IS days[0].date and the range
    // end IS days.at(-1).date — a `date`/`since` key is the speculative
    // surface this repo treats as a finding, and it never parses.
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

    // min(1): `since <= today` holds by construction (both come off the
    // same DB clock), so an empty enumeration is impossible — the schema
    // makes it a parse failure, i.e. a 500, not a silent lie.
    expect(statsCalendarResponseSchema.safeParse({ days: [] }).success).toBe(
      false,
    );
  });

  it("T-CORE-S69a: a calendar day must be a real day — a shape-valid non-day fails the parse instead of reaching a throwing parser", () => {
    // `days[].date` goes into throwing parsers on the client (`epochDay`,
    // the `Intl` formatters), so `calendarDateString` makes a malformed
    // 200 a `safeParse` failure — the honest settled-null zero — never a
    // `RangeError` mid-render.
    for (const date of ["0000-00-00", "0000-01-01", "2026-02-30"]) {
      expect(
        statsCalendarResponseSchema.safeParse({
          days: [{ date, state: "missed", perfect: false }],
        }).success,
      ).toBe(false);
    }
    // The asymmetry is deliberate: `statsResponseSchema.date` stays
    // shape-only (`isoDateString`) because it feeds string EQUALITY checks
    // only, never a parser — the repo convention for server-derived
    // comparands.
    expect(
      statsResponseSchema.safeParse({ ...validStats, date: "0000-00-00" })
        .success,
    ).toBe(true);
  });
});
