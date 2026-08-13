import { describe, expect, it } from "vitest";

import {
  computeCalendar,
  computeStats,
  perfectDays,
  timeBucketIndex,
  type StatsRow,
} from "../src/index";

/**
 * Unit fixtures for the #29 derivations (ADR-0008, ADR-0051; plan 033 §4).
 * Every exclusion rule is pinned here at seam 2 — the pure functions are the
 * ONLY place lost and late rows are excluded (D3), so these fixtures are the
 * rules' home ground. The property suite (stats-properties.test.ts) carries
 * the quantified claims.
 */

const TODAY = "2026-08-13";
const YESTERDAY = "2026-08-12";

/** A row with the on-time-win defaults; override what the case is about. */
function row(
  init: Partial<StatsRow> & Pick<StatsRow, "game" | "date">,
): StatsRow {
  return {
    outcome: "won",
    onTime: true,
    elapsedMs: 300_000,
    hintsUsed: 0,
    guesses: init.game === "termo" ? 4 : null,
    ...init,
  };
}

/** All four games won on time on `date` — the Dia Perfeito construction. */
function perfectDay(date: string): StatsRow[] {
  return [
    row({ game: "binairo", date }),
    row({ game: "sudoku", date }),
    row({ game: "nonogram", date }),
    row({ game: "termo", date }),
  ];
}

describe("perfectDays (ADR-0051, plan 033 D7)", () => {
  it("T-CORE-S59: exactly four on-time wins of one day is perfect; any three are not", () => {
    const allFour = perfectDay("2026-08-10");
    expect(perfectDays(allFour)).toEqual(["2026-08-10"]);
    // Dropping any one of the four games un-perfects the day.
    for (let i = 0; i < allFour.length; i += 1) {
      const three = allFour.filter((_, index) => index !== i);
      expect(perfectDays(three)).toEqual([]);
    }
    // Two perfect days arrive sorted ascending regardless of input order.
    expect(
      perfectDays([...perfectDay("2026-08-11"), ...perfectDay("2026-08-09")]),
    ).toEqual(["2026-08-09", "2026-08-11"]);
  });

  it("T-CORE-S60: a lost Termo forfeits the day; a late win never counts; a played row never counts", () => {
    // Lost Termo, ON TIME, beside three on-time grid wins: the lost row
    // occupies Termo's only slot (the composite PK), so the day is
    // structurally forfeit — the #27-comment obligation, AC 1.
    expect(
      perfectDays([
        row({ game: "binairo", date: TODAY }),
        row({ game: "sudoku", date: TODAY }),
        row({ game: "nonogram", date: TODAY }),
        row({ game: "termo", date: TODAY, outcome: "lost", guesses: 6 }),
      ]),
    ).toEqual([]);
    // A LATE win as the fourth game never completes the set.
    expect(
      perfectDays([
        row({ game: "binairo", date: TODAY }),
        row({ game: "sudoku", date: TODAY }),
        row({ game: "nonogram", date: TODAY }),
        row({ game: "termo", date: TODAY, onTime: false }),
      ]),
    ).toEqual([]);
    // A played (lost) row never contributes, on time or not — stated over a
    // manufactured lost grid row too: the function is total over its type.
    expect(
      perfectDays([
        row({ game: "binairo", date: TODAY, outcome: "lost" }),
        row({ game: "sudoku", date: TODAY }),
        row({ game: "nonogram", date: TODAY }),
        row({ game: "termo", date: TODAY }),
      ]),
    ).toEqual([]);
  });
});

describe("computeCalendar (ADR-0008 rule 2, plan 033 D6)", () => {
  const SINCE = "2026-08-10";

  it("T-CORE-S63: per-date precedence, the clamped range edge, inclusive endpoints, inert future rows", () => {
    // A mixed day — on-time win + late win + loss — renders "onTime"
    // (precedence on-time > late > missed), and a four-win day carries the
    // perfect marker, which only ever rides an "onTime" day.
    const mixed = computeCalendar(
      [
        row({ game: "binairo", date: SINCE }),
        row({ game: "sudoku", date: SINCE, onTime: false }),
        row({ game: "termo", date: SINCE, outcome: "lost", guesses: 6 }),
        ...perfectDay("2026-08-11"),
        // A lost-ONLY day colours nothing: played is not completed
        // (ADR-0008's three verbs) — the loss lives in the fail row, not
        // on the calendar.
        row({ game: "termo", date: "2026-08-12", outcome: "lost", guesses: 5 }),
      ],
      SINCE,
      TODAY,
      1,
    );
    expect(mixed).toEqual([
      { date: "2026-08-10", state: "onTime", perfect: false },
      { date: "2026-08-11", state: "onTime", perfect: true },
      { date: "2026-08-12", state: "missed", perfect: false },
      { date: "2026-08-13", state: "missed", perfect: false },
    ]);

    // Both endpoints inclusive; no rows at all enumerates [since, today].
    const empty = computeCalendar([], SINCE, TODAY, 1);
    expect(empty.map((day) => day.date)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(empty.every((day) => day.state === "missed")).toBe(true);

    // The D6 clamp. A row exactly `acceptedDaysBack` days before `since`
    // (the birth-midnight write) extends the range to reach it…
    const birthEdge = computeCalendar(
      [row({ game: "binairo", date: "2026-08-09", onTime: false })],
      SINCE,
      TODAY,
      1,
    );
    expect(birthEdge[0]).toEqual({
      date: "2026-08-09",
      state: "late",
      perfect: false,
    });
    // …while a row earlier than that never drags the start past the bound:
    // it emits NO day entry and the range start stays clamped at
    // since − acceptedDaysBack (the unbounded min() rejected at step 3).
    const farRow = row({ game: "binairo", date: "2026-08-03", onTime: false });
    const clamped = computeCalendar([farRow], SINCE, TODAY, 1);
    expect(clamped.map((day) => day.date)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(clamped.every((day) => day.date !== "2026-08-03")).toBe(true);
    // Out of calendar range is NOT out of the statistics: the same row
    // still feeds every computeStats aggregate (D6's rendering rule).
    expect(computeStats([farRow], TODAY).binairo.solved).toBe(1);

    // A future-dated row (rendered impossible by ADR-0026 decision 6) is
    // inert: the enumeration still ends at today.
    const future = computeCalendar(
      [row({ game: "binairo", date: "2026-08-14" })],
      SINCE,
      TODAY,
      1,
    );
    expect(future.at(-1)?.date).toBe(TODAY);
    expect(future).toHaveLength(4);

    // since > today is a guard, not a reachable state: empty.
    expect(computeCalendar([], "2026-08-14", TODAY, 1)).toEqual([]);
  });
});

describe("computeStats — times and totals (plan 033 §4.4, ADR-0051 decision 6)", () => {
  it("T-CORE-S65: best is all-time, average is the 30-day window with its sample count, late/lost rows move solved only", () => {
    const rows = [
      // On-time wins: today, 29 days back (in window), 30 back (the exact
      // boundary, excluded: the window is epochDay(date) > today − 30),
      // 31 back (excluded, but the all-time best).
      row({ game: "binairo", date: TODAY, elapsedMs: 300_000 }),
      row({ game: "binairo", date: "2026-07-15", elapsedMs: 100_000 }),
      row({ game: "binairo", date: "2026-07-14", elapsedMs: 500_000 }),
      row({ game: "binairo", date: "2026-07-13", elapsedMs: 50_000 }),
      // A late win: counted in `solved`, invisible to best/average/histogram.
      row({
        game: "binairo",
        date: "2026-08-11",
        onTime: false,
        elapsedMs: 10_000,
      }),
      // A manufactured lost grid row (only Termo loses in production; the
      // predicate is stated, not assumed): moves nothing at all.
      row({
        game: "binairo",
        date: "2026-08-10",
        outcome: "lost",
        elapsedMs: 1_000,
      }),
    ];
    const stats = computeStats(rows, TODAY);
    // Late wins are honestly solves (ADR-0008 rule 2 names distributions
    // and time stats, not totals); the lost row is not.
    expect(stats.binairo.solved).toBe(5);
    // Best over ALL on-time wins — the 31-day-old row holds it and the
    // 10_000 ms late row never takes it.
    expect(stats.binairo.bestMs).toBe(50_000);
    // Average over the 30-day on-time window only: today + 29-days-back.
    expect(stats.binairo.averageMs).toBe(200_000);
    expect(stats.binairo.averageSampleCount).toBe(2);
    // Histogram over on-time wins, all time: 100k→0, 50k→0, 300k→2, 500k→4.
    expect(stats.binairo.histogram).toEqual([2, 0, 1, 0, 1, 0]);

    // No on-time win inside the window ⇒ averageMs null ⇔ sample count 0,
    // while best stays the all-time value.
    const stale = computeStats(
      [row({ game: "sudoku", date: "2026-07-01", elapsedMs: 400_000 })],
      TODAY,
    );
    expect(stale.sudoku.bestMs).toBe(400_000);
    expect(stale.sudoku.averageMs).toBeNull();
    expect(stale.sudoku.averageSampleCount).toBe(0);
    // The honest zero: no rows at all.
    expect(stale.nonogram).toEqual({
      solved: 0,
      bestMs: null,
      averageMs: null,
      averageSampleCount: 0,
      histogram: [0, 0, 0, 0, 0, 0],
    });

    // Bucket edges are upper-exclusive (F5's six buckets).
    expect(timeBucketIndex(239_999)).toBe(0);
    expect(timeBucketIndex(240_000)).toBe(1);
    expect(timeBucketIndex(540_000)).toBe(5);
  });

  it("T-CORE-S66: the distribution buckets on-time wins by guesses; the fail row counts every lost row, unqualified", () => {
    const stats = computeStats(
      [
        row({ game: "termo", date: "2026-08-01", guesses: 1 }),
        row({ game: "termo", date: "2026-08-02", guesses: 4 }),
        row({ game: "termo", date: "2026-08-03", guesses: 4 }),
        // A late WIN feeds no bucket (ADR-0008 rule 2) — solved only.
        row({ game: "termo", date: "2026-08-04", onTime: false, guesses: 3 }),
        // The fail row is ADR-0008 rule 3 exactly as written: ALL lost
        // rows, a manufactured late loss included — a lost row is
        // *played*, a different verb, and rule 2's late-completion
        // exclusions never reach it.
        row({
          game: "termo",
          date: "2026-08-05",
          outcome: "lost",
          guesses: 6,
        }),
        row({
          game: "termo",
          date: "2026-08-06",
          outcome: "lost",
          onTime: false,
          guesses: 6,
        }),
        // A won on-time row with null guesses is impossible under
        // `completions_guesses_check`; the total function ignores it.
        row({ game: "termo", date: "2026-08-07", guesses: null }),
      ],
      TODAY,
    );
    expect(stats.termo.distribution).toEqual([1, 0, 0, 2, 0, 0, 2]);
    // Termo's solved follows the same all-wins rule (late included; the
    // null-guess row is still a win for the total).
    expect(stats.termo.solved).toBe(5);
  });

  it("T-CORE-S67: todayTermoGuesses is the won-today row's count, else null", () => {
    // Won today → the count (on time by construction; no onTime conjunct).
    expect(
      computeStats([row({ game: "termo", date: TODAY, guesses: 5 })], TODAY)
        .todayTermoGuesses,
    ).toBe(5);
    // Lost today → null (the conclusion highlights the fail row locally).
    expect(
      computeStats(
        [row({ game: "termo", date: TODAY, outcome: "lost", guesses: 6 })],
        TODAY,
      ).todayTermoGuesses,
    ).toBeNull();
    // No Termo row at all → null.
    expect(computeStats([], TODAY).todayTermoGuesses).toBeNull();
    // Won YESTERDAY → null: the value is today's or nothing.
    expect(
      computeStats([row({ game: "termo", date: YESTERDAY, guesses: 2 })], TODAY)
        .todayTermoGuesses,
    ).toBeNull();
  });
});
