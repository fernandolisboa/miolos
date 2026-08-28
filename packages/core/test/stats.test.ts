import { describe, expect, it } from "vitest";

import {
  computeCalendar,
  computeStats,
  perfectDays,
  timeBucketIndex,
  type StatsRow,
} from "../src/index";

const TODAY = "2026-08-13";
const YESTERDAY = "2026-08-12";

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

    for (let i = 0; i < allFour.length; i += 1) {
      const three = allFour.filter((_, index) => index !== i);
      expect(perfectDays(three)).toEqual([]);
    }

    expect(
      perfectDays([...perfectDay("2026-08-11"), ...perfectDay("2026-08-09")]),
    ).toEqual(["2026-08-09", "2026-08-11"]);
  });

  it("T-CORE-S60: a lost Termo forfeits the day; a late win never counts; a played row never counts", () => {
    expect(
      perfectDays([
        row({ game: "binairo", date: TODAY }),
        row({ game: "sudoku", date: TODAY }),
        row({ game: "nonogram", date: TODAY }),
        row({ game: "termo", date: TODAY, outcome: "lost", guesses: 6 }),
      ]),
    ).toEqual([]);

    expect(
      perfectDays([
        row({ game: "binairo", date: TODAY }),
        row({ game: "sudoku", date: TODAY }),
        row({ game: "nonogram", date: TODAY }),
        row({ game: "termo", date: TODAY, onTime: false }),
      ]),
    ).toEqual([]);

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
    const mixed = computeCalendar(
      [
        row({ game: "binairo", date: SINCE }),
        row({ game: "sudoku", date: SINCE, onTime: false }),
        row({ game: "termo", date: SINCE, outcome: "lost", guesses: 6 }),
        ...perfectDay("2026-08-11"),

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

    const empty = computeCalendar([], SINCE, TODAY, 1);
    expect(empty.map((day) => day.date)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(empty.every((day) => day.state === "missed")).toBe(true);

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

    const farRow = row({ game: "binairo", date: "2026-08-03", onTime: false });
    const clamped = computeCalendar([farRow], SINCE, TODAY, 1);
    expect(clamped.map((day) => day.date)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(clamped.every((day) => day.date !== "2026-08-03")).toBe(true);

    expect(computeStats([farRow], TODAY).binairo.solved).toBe(1);

    const future = computeCalendar(
      [row({ game: "binairo", date: "2026-08-14" })],
      SINCE,
      TODAY,
      1,
    );
    expect(future.at(-1)?.date).toBe(TODAY);
    expect(future).toHaveLength(4);

    expect(computeCalendar([], "2026-08-14", TODAY, 1)).toEqual([]);
  });

  it("T-CORE-S63a: only a won row extends the range — a lost row at since − 1 never does, a won row there does, a far won row does not", () => {
    const lostAtBirthEdge = row({
      game: "termo",
      date: "2026-08-09",
      outcome: "lost",
      onTime: false,
      guesses: 6,
    });
    const lostOnly = computeCalendar([lostAtBirthEdge], SINCE, TODAY, 1);
    expect(lostOnly.map((day) => day.date)).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(computeStats([lostAtBirthEdge], TODAY).termo.distribution[6]).toBe(
      1,
    );

    const wonAtBirthEdge = row({
      game: "binairo",
      date: "2026-08-09",
      onTime: false,
    });
    const wonExtends = computeCalendar(
      [lostAtBirthEdge, wonAtBirthEdge],
      SINCE,
      TODAY,
      1,
    );
    expect(wonExtends[0]).toEqual({
      date: "2026-08-09",
      state: "late",
      perfect: false,
    });

    const farWon = row({ game: "sudoku", date: "2026-08-01" });
    const farOnly = computeCalendar([farWon], SINCE, TODAY, 1);
    expect(farOnly[0]?.date).toBe(SINCE);
    expect(computeStats([farWon], TODAY).sudoku.solved).toBe(1);
  });
});

describe("computeCalendar after the archive widening (#31, ADR-0053)", () => {
  const SINCE = "2026-08-10";

  it("T-CORE-S80: a pre-birth late win is off-calendar and the aggregates still carry it", () => {
    const prebirth = row({
      game: "binairo",
      date: "2025-07-06",
      onTime: false,
    });
    const days = computeCalendar([prebirth], SINCE, TODAY, 1);

    expect(days.some((day) => day.date === "2025-07-06")).toBe(false);
    expect(days[0]?.date).toBe(SINCE);
    expect(days).toHaveLength(4);

    expect(days.every((day) => day.date >= SINCE)).toBe(true);

    expect(computeStats([prebirth], TODAY).binairo.solved).toBe(1);
  });

  it("T-CORE-S81: the clamp is fed by rollover slack, not by the write window", () => {
    for (const onTime of [true, false]) {
      const twoBack = row({ game: "sudoku", date: "2026-08-08", onTime });
      expect(computeCalendar([twoBack], SINCE, TODAY, 1)[0]?.date).toBe(SINCE);

      const oneBack = row({ game: "sudoku", date: "2026-08-09", onTime });
      expect(computeCalendar([oneBack], SINCE, TODAY, 1)[0]?.date).toBe(
        "2026-08-09",
      );
    }
  });

  it("T-CORE-S82: a late win inside the range renders 'late', and precedence is unchanged by far-past rows", () => {
    const insideRange = row({
      game: "binairo",
      date: "2026-08-11",
      onTime: false,
    });
    const farPast = row({ game: "sudoku", date: "2024-01-02", onTime: false });
    const onTimeSameDay = row({ game: "nonogram", date: "2026-08-12" });
    const lateSameDay = row({
      game: "sudoku",
      date: "2026-08-12",
      onTime: false,
    });

    const days = computeCalendar(
      [insideRange, farPast, onTimeSameDay, lateSameDay],
      SINCE,
      TODAY,
      1,
    );
    expect(days).toEqual([
      { date: "2026-08-10", state: "missed", perfect: false },
      { date: "2026-08-11", state: "late", perfect: false },

      { date: "2026-08-12", state: "onTime", perfect: false },
      { date: "2026-08-13", state: "missed", perfect: false },
    ]);
  });

  it("T-CORE-S83: a late lost row colours nothing and still counts in the fail row; a late win never reaches perfectDays", () => {
    const lateLoss = row({
      game: "termo",
      date: "2026-08-11",
      outcome: "lost",
      onTime: false,
      guesses: 6,
    });
    expect(computeCalendar([lateLoss], SINCE, TODAY, 1)[1]).toEqual({
      date: "2026-08-11",
      state: "missed",
      perfect: false,
    });
    expect(computeStats([lateLoss], TODAY).termo.distribution[6]).toBe(1);

    const lateAll = [
      row({ game: "binairo", date: "2026-08-11", onTime: false }),
      row({ game: "sudoku", date: "2026-08-11", onTime: false }),
      row({ game: "nonogram", date: "2026-08-11", onTime: false }),
      row({ game: "termo", date: "2026-08-11", onTime: false }),
    ];
    expect(perfectDays(lateAll)).toEqual([]);
    expect(
      computeCalendar(lateAll, SINCE, TODAY, 1).every((day) => !day.perfect),
    ).toBe(true);
  });
});

describe("computeStats — times and totals (plan 033 §4.4, ADR-0051 decision 6)", () => {
  it("T-CORE-S65: best is all-time, average is the 30-day window with its sample count; a late win moves `solved` only; a lost row moves nothing", () => {
    const rows = [
      row({ game: "binairo", date: TODAY, elapsedMs: 300_000 }),
      row({ game: "binairo", date: "2026-07-15", elapsedMs: 100_000 }),
      row({ game: "binairo", date: "2026-07-14", elapsedMs: 500_000 }),
      row({ game: "binairo", date: "2026-07-13", elapsedMs: 50_000 }),

      row({
        game: "binairo",
        date: "2026-08-11",
        onTime: false,
        elapsedMs: 10_000,
      }),

      row({
        game: "binairo",
        date: "2026-08-10",
        outcome: "lost",
        elapsedMs: 1_000,
      }),
    ];
    const stats = computeStats(rows, TODAY);

    expect(stats.binairo.solved).toBe(5);

    expect(stats.binairo.bestMs).toBe(50_000);

    expect(stats.binairo.averageMs).toBe(200_000);
    expect(stats.binairo.averageSampleCount).toBe(2);

    expect(stats.binairo.histogram).toEqual([2, 0, 1, 0, 1, 0]);

    const stale = computeStats(
      [row({ game: "sudoku", date: "2026-07-01", elapsedMs: 400_000 })],
      TODAY,
    );
    expect(stale.sudoku.bestMs).toBe(400_000);
    expect(stale.sudoku.averageMs).toBeNull();
    expect(stale.sudoku.averageSampleCount).toBe(0);

    expect(stale.nonogram).toEqual({
      solved: 0,
      bestMs: null,
      averageMs: null,
      averageSampleCount: 0,
      histogram: [0, 0, 0, 0, 0, 0],
    });

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

        row({ game: "termo", date: "2026-08-04", onTime: false, guesses: 3 }),

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

        row({ game: "termo", date: "2026-08-07", guesses: null }),
      ],
      TODAY,
    );
    expect(stats.termo.distribution).toEqual([1, 0, 0, 2, 0, 0, 2]);

    expect(stats.termo.solved).toBe(5);
  });

  it("T-CORE-S67: todayTermoGuesses is the won-today row's count, else null", () => {
    expect(
      computeStats([row({ game: "termo", date: TODAY, guesses: 5 })], TODAY)
        .todayTermoGuesses,
    ).toBe(5);

    expect(
      computeStats(
        [row({ game: "termo", date: TODAY, outcome: "lost", guesses: 6 })],
        TODAY,
      ).todayTermoGuesses,
    ).toBeNull();

    expect(computeStats([], TODAY).todayTermoGuesses).toBeNull();

    expect(
      computeStats([row({ game: "termo", date: YESTERDAY, guesses: 2 })], TODAY)
        .todayTermoGuesses,
    ).toBeNull();
  });

  it("T-CORE-S67a: duplicate won-today termo rows answer the minimum guess count — total and order-independent", () => {
    const five = row({ game: "termo", date: TODAY, guesses: 5 });
    const two = row({ game: "termo", date: TODAY, guesses: 2 });
    expect(computeStats([five, two], TODAY).todayTermoGuesses).toBe(2);
    expect(computeStats([two, five], TODAY).todayTermoGuesses).toBe(2);

    const nullGuess = row({ game: "termo", date: TODAY, guesses: null });
    expect(computeStats([nullGuess, five], TODAY).todayTermoGuesses).toBe(5);
    expect(computeStats([nullGuess], TODAY).todayTermoGuesses).toBeNull();
  });
});
