import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  computeCalendar,
  computeStats,
  epochDay,
  dateFromEpochDay,
  perfectDays,
  COMPLETION_OUTCOMES,
  GAMES,
  type StatsRow,
} from "../src/index";

/**
 * Property tests for the #29 derivations (ADR-0023: main properties run at
 * ≥ 100; these all run at exactly 100, pinned seed). The domain is
 * quantified as epoch days in a window around a generated `today` — the
 * streak-properties register — so same-date collisions and range structure,
 * the things these functions are about, arise often instead of never. Rows
 * are quantified over the FULL type (lost grid rows, null-guess termo rows
 * included): the functions are total, and the properties must hold anyway.
 */

// A comfortable modern window: 2020-01-01 (18262) .. 2030-12-31 (22279).
const DAY_MIN = 18_262;
const DAY_MAX = 22_279;

const todayDayArb = fc.integer({ min: DAY_MIN + 50, max: DAY_MAX });

/** Rows clustered near `today` so day structure actually arises. */
function rowArb(todayDay: number): fc.Arbitrary<StatsRow> {
  return fc.record({
    game: fc.constantFrom(...GAMES),
    date: fc
      .integer({ min: todayDay - 45, max: todayDay + 2 })
      .map((day) => dateFromEpochDay(day)),
    outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
    onTime: fc.boolean(),
    elapsedMs: fc.integer({ min: 0, max: 3_600_000 }),
    hintsUsed: fc.integer({ min: 0, max: 3 }),
    guesses: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
  });
}

const inputArb = todayDayArb.chain((todayDay) =>
  fc.record({
    todayDay: fc.constant(todayDay),
    today: fc.constant(dateFromEpochDay(todayDay)),
    rows: fc.array(rowArb(todayDay), { maxLength: 80 }),
  }),
);

/** since ≤ today always, at most 45 days back — the enumeration's domain. */
const sinceOffsetArb = fc.integer({ min: 0, max: 45 });
const rolloverSlackDaysArb = fc.integer({ min: 0, max: 5 });

describe("stats derivations — properties (ADR-0023)", () => {
  it("T-CORE-S61: d ∈ perfectDays(rows) ⇔ all four games hold a won-on-time row dated d — a date set, never a run length", () => {
    fc.assert(
      fc.property(inputArb, ({ rows }) => {
        const result = perfectDays(rows);
        // A sorted, duplicate-free date SET. There is no run-length
        // arithmetic in the module to test — D7's "never a second streak"
        // is an absence, pinned by the output type being a set of dates.
        expect([...result]).toEqual([...new Set(result)].sort());
        // The biconditional, against an independently recomputed oracle.
        const candidateDates = new Set(rows.map((row) => row.date));
        for (const date of candidateDates) {
          const wonOnTimeGames = new Set(
            rows
              .filter(
                (row) =>
                  row.date === date && row.outcome === "won" && row.onTime,
              )
              .map((row) => row.game),
          );
          expect(result.includes(date)).toBe(
            wonOnTimeGames.size === GAMES.length,
          );
        }
        // Nothing outside the rows' own dates is ever perfect.
        for (const date of result) {
          expect(candidateDates.has(date)).toBe(true);
        }
      }),
      { numRuns: 100, seed: 20_260_829 },
    );
  });

  it("T-CORE-S62: permutation invariance and determinism of perfectDays, computeCalendar and computeStats", () => {
    fc.assert(
      fc.property(
        inputArb,
        sinceOffsetArb,
        rolloverSlackDaysArb,
        fc.infiniteStream(fc.nat()),
        (
          { todayDay, today, rows },
          sinceOffset,
          rolloverSlackDays,
          indices,
        ) => {
          const since = dateFromEpochDay(todayDay - sinceOffset);
          const referencePerfect = perfectDays(rows);
          const referenceCalendar = computeCalendar(
            rows,
            since,
            today,
            rolloverSlackDays,
          );
          const referenceStats = computeStats(rows, today);
          // Repeated calls agree (determinism: no clock, no randomness).
          expect(perfectDays(rows)).toEqual(referencePerfect);
          expect(
            computeCalendar(rows, since, today, rolloverSlackDays),
          ).toEqual(referenceCalendar);
          expect(computeStats(rows, today)).toEqual(referenceStats);
          // Any permutation agrees (the T-CORE-S30 shuffle).
          const shuffled = [...rows];
          for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const next = indices.next();
            const j = (next.done ? 0 : next.value) % (i + 1);
            const a = shuffled[i];
            const b = shuffled[j];
            if (a !== undefined && b !== undefined) {
              shuffled[i] = b;
              shuffled[j] = a;
            }
          }
          expect(perfectDays(shuffled)).toEqual(referencePerfect);
          expect(
            computeCalendar(shuffled, since, today, rolloverSlackDays),
          ).toEqual(referenceCalendar);
          expect(computeStats(shuffled, today)).toEqual(referenceStats);
        },
      ),
      { numRuns: 100, seed: 20_260_829 },
    );
  });

  it("T-CORE-S64: the calendar enumerates [effectiveSince, today] exactly once each, in order, states and markers agreeing with the rows; the range start EQUALS the won-only clamp recomputed independently", () => {
    fc.assert(
      fc.property(
        inputArb,
        sinceOffsetArb,
        rolloverSlackDaysArb,
        ({ todayDay, today, rows }, sinceOffset, rolloverSlackDays) => {
          const sinceDay = todayDay - sinceOffset;
          const since = dateFromEpochDay(sinceDay);
          const days = computeCalendar(rows, since, today, rolloverSlackDays);
          const perfect = new Set(perfectDays(rows));

          // Never empty for since ≤ today, and the last entry IS today.
          expect(days.length).toBeGreaterThanOrEqual(1);
          expect(days.at(-1)?.date).toBe(today);

          // The clamp (D6, won-only — the step-6 correction): the range
          // start EQUALS the decided rule, recomputed independently here:
          // min(sinceDay, min over won-row days within the bound), the
          // empty set answering sinceDay. Equality, not a one-sided
          // inequality — a lost or out-of-bound row never extends, and a
          // won row within the bound always does.
          const wonDaysWithinBound = rows
            .filter((row) => row.outcome === "won")
            .map((row) => epochDay(row.date))
            .filter((day) => day >= sinceDay - rolloverSlackDays);
          const expectedStart = Math.min(sinceDay, ...wonDaysWithinBound);
          expect(epochDay(days[0]?.date ?? "")).toBe(expectedStart);

          // Each date of [expectedStart, today] exactly once, in order —
          // the length recomputed from the rule, never read back — each
          // state and perfect marker agreeing with the row predicates
          // recomputed independently.
          expect(days.length).toBe(todayDay - expectedStart + 1);
          days.forEach((day, index) => {
            expect(day.date).toBe(dateFromEpochDay(expectedStart + index));
            const hasOnTimeWin = rows.some(
              (row) =>
                row.date === day.date && row.outcome === "won" && row.onTime,
            );
            const hasLateWin = rows.some(
              (row) =>
                row.date === day.date && row.outcome === "won" && !row.onTime,
            );
            const expectedState = hasOnTimeWin
              ? "onTime"
              : hasLateWin
                ? "late"
                : "missed";
            expect(day.state).toBe(expectedState);
            expect(day.perfect).toBe(perfect.has(day.date));
          });
        },
      ),
      { numRuns: 100, seed: 20_260_829 },
    );
  });

  it("T-CORE-S84: however far back the rows reach, every emitted date lies in [since − rolloverSlackDays, today] — the fabricated-`missed` impossibility", () => {
    // #31 removes the write window's lower bound, so rows may now be dated
    // ARBITRARILY far before `since`. This is the bound that makes the
    // constant split load-bearing: the clamp follows the rollover slack,
    // never the write window, so no quantity of far-past rows can drag the
    // range back and paint days the account did not exist for.
    //
    // Stated as a two-sided BOUND, not as an equality against a
    // recomputed `effectiveSince`: recomputing the clamp here would make
    // the property a tautology of the code under test, and reading the
    // start off the output would make it vacuous. T-CORE-S64 already owns
    // the exact-clamp claim over rows clustered near `today`; this one
    // owns the archive's row distribution.
    const archiveRowArb = (todayDay: number): fc.Arbitrary<StatsRow> =>
      fc.record({
        game: fc.constantFrom(...GAMES),
        // Up to ~5 years back: the archive's real reach, not a window.
        date: fc
          .integer({ min: todayDay - 1_800, max: todayDay + 2 })
          .map((day) => dateFromEpochDay(day)),
        outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
        onTime: fc.boolean(),
        elapsedMs: fc.integer({ min: 0, max: 3_600_000 }),
        hintsUsed: fc.integer({ min: 0, max: 3 }),
        guesses: fc.option(fc.integer({ min: 1, max: 6 }), { nil: null }),
      });

    fc.assert(
      fc.property(
        todayDayArb.chain((todayDay) =>
          fc.record({
            todayDay: fc.constant(todayDay),
            today: fc.constant(dateFromEpochDay(todayDay)),
            rows: fc.array(archiveRowArb(todayDay), { maxLength: 80 }),
          }),
        ),
        sinceOffsetArb,
        rolloverSlackDaysArb,
        ({ todayDay, today, rows }, sinceOffset, rolloverSlackDays) => {
          const sinceDay = todayDay - sinceOffset;
          const since = dateFromEpochDay(sinceDay);
          const days = computeCalendar(rows, since, today, rolloverSlackDays);

          const floor = sinceDay - rolloverSlackDays;
          for (const day of days) {
            expect(epochDay(day.date)).toBeGreaterThanOrEqual(floor);
            expect(epochDay(day.date)).toBeLessThanOrEqual(todayDay);
          }
          // And the bound is not vacuous: the enumeration always reaches
          // today, so an implementation that emitted nothing would fail.
          expect(days.at(-1)?.date).toBe(today);
        },
      ),
      { numRuns: 100, seed: 20_260_814 },
    );
  });
});
