import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  COMPLETION_OUTCOMES,
  computeStreak,
  DAY_STATUSES,
  dayGamesFromRows,
  dayResponseSchema,
  dayStateFromRows,
  GAMES,
  mergeDayState,
  mergeDayStatus,
  type DayGameStatus,
  type DayRow,
  type DayState,
  type Game,
  type StreakRow,
} from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

const ALL_STATUSES: readonly DayGameStatus[] = DAY_STATUSES;

function stateOf(
  overrides: Partial<Record<Game, DayGameStatus>> = {},
): DayState {
  return {
    termo: "pending",
    sudoku: "pending",
    nonogram: "pending",
    binairo: "pending",
    ...overrides,
  };
}

function withStatus(
  state: DayState,
  game: Game,
  status: DayGameStatus,
): DayState {
  return {
    termo: game === "termo" ? status : state.termo,
    sudoku: game === "sudoku" ? status : state.sudoku,
    nonogram: game === "nonogram" ? status : state.nonogram,
    binairo: game === "binairo" ? status : state.binairo,
  };
}

const statusArb = fc.constantFrom(...ALL_STATUSES);

const ELAPSED_MS = 61_000;

function rowOf(
  game: Game,
  outcome: DayRow["outcome"],
  onTime: boolean,
  elapsedMs: number = ELAPSED_MS,
  hintsUsed = 0,
): DayRow {
  return { game, outcome, onTime, elapsedMs, hintsUsed };
}

const stateArb: fc.Arbitrary<DayState> = fc.record({
  termo: statusArb,
  sudoku: statusArb,
  nonogram: statusArb,
  binairo: statusArb,
});

describe("dayResponseSchema — the wire contract (#83, ADR-0060 decision 1)", () => {
  const valid = {
    date: "2026-08-19",
    games: {
      termo: { status: "completed" },
      sudoku: { status: "pending" },
      nonogram: { status: "played" },
      binairo: { status: "completed", elapsedMs: 407_000, hintsUsed: 1 },
    },
  };

  it("T-CORE-S86: strict on both ends — unknown keys, a missing game, an unknown status and a malformed date all fail", () => {
    expect(dayResponseSchema.parse(valid)).toEqual(valid);

    const malformed: readonly unknown[] = [
      { ...valid, streak: 3 },

      { ...valid, games: { ...valid.games, xadrez: { status: "pending" } } },

      {
        ...valid,
        games: {
          ...valid.games,
          sudoku: { status: "pending", onTime: true },
        },
      },

      {
        date: valid.date,
        games: {
          termo: { status: "completed" },
          sudoku: { status: "pending" },
          nonogram: { status: "played" },
        },
      },

      { ...valid, games: { ...valid.games, sudoku: { status: "late" } } },

      { ...valid, games: { ...valid.games, sudoku: "pending" } },

      { ...valid, date: "19/08/2026" },
      { ...valid, date: "2026-8-19" },

      { date: valid.date },
      { ...valid, games: "completed" },
      "not an object",
    ];
    for (const body of malformed) {
      expect(
        dayResponseSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });

  it("T-CORE-S94: the payload's key set is exactly {date, games} over exactly the four games — the ADR-0004 tripwire", () => {
    expect(Object.keys(dayResponseSchema.shape).sort()).toEqual([
      "date",
      "games",
    ]);
    expect(Object.keys(dayResponseSchema.shape.games.shape).sort()).toEqual(
      [...GAMES].sort(),
    );

    //

    //

    for (const game of GAMES) {
      expect(
        Object.keys(dayResponseSchema.shape.games.shape[game].shape).sort(),
        game,
      ).toEqual(["elapsedMs", "hintsUsed", "motifName", "status"]);
    }

    //

    const keys = collectKeys(dayResponseSchema.parse(valid));
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect([...keys], forbidden).not.toContain(forbidden);
    }
  });

  it("T-CORE-S95: the wire status enum is exactly the local projection's three verbs — an alias, never a second spelling", () => {
    expect([...DAY_STATUSES].sort()).toEqual([
      "completed",
      "pending",
      "played",
    ]);

    expect(
      dayResponseSchema.shape.games.shape.termo.shape.status.options,
    ).toEqual([...DAY_STATUSES]);
  });

  it("T-CORE-S99: a claim carries `elapsedMs` only when completed, and the producer publishes it for completed grid games and never for Termo (#141)", () => {
    const withGame = (game: unknown) => ({
      ...valid,
      games: { ...valid.games, sudoku: game },
    });
    for (const body of [
      withGame({ status: "pending", elapsedMs: 61_000 }),
      withGame({ status: "played", elapsedMs: 61_000 }),
      withGame({ status: "completed", elapsedMs: -1 }),
      withGame({ status: "completed", elapsedMs: 61.5 }),
      withGame({ status: "completed", elapsedMs: "61000" }),
      withGame({ status: "completed", elapsedMs: 86_400_001 }),
    ]) {
      expect(
        dayResponseSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }

    expect(
      dayResponseSchema.safeParse(withGame({ status: "completed" })).success,
    ).toBe(true);

    expect(
      dayGamesFromRows([
        rowOf("sudoku", "won", true, 512_000),
        rowOf("termo", "lost", true, 188_000),
        rowOf("nonogram", "won", false, 99_000),
        rowOf("binairo", "won", true, 407_000),
      ]),
    ).toEqual({
      termo: { status: "played" },
      sudoku: { status: "completed", elapsedMs: 512_000, hintsUsed: 0 },
      nonogram: { status: "pending" },
      binairo: { status: "completed", elapsedMs: 407_000, hintsUsed: 0 },
    });

    expect(dayGamesFromRows([rowOf("termo", "won", true, 188_000)])).toEqual({
      termo: { status: "completed" },
      sudoku: { status: "pending" },
      nonogram: { status: "pending" },
      binairo: { status: "pending" },
    });

    expect(
      dayResponseSchema.safeParse({
        date: valid.date,
        games: dayGamesFromRows([rowOf("binairo", "won", true, 407_000)]),
      }).success,
    ).toBe(true);
  });

  it("T-CORE-S103: a claim carries `hintsUsed` only when completed, and the producer publishes it for completed grid games and never for Termo (#142)", () => {
    const withGame = (game: unknown) => ({
      ...valid,
      games: { ...valid.games, sudoku: game },
    });
    for (const body of [
      withGame({ status: "pending", hintsUsed: 0 }),
      withGame({ status: "played", hintsUsed: 1 }),
      withGame({ status: "completed", hintsUsed: -1 }),
      withGame({ status: "completed", hintsUsed: 0.5 }),
      withGame({ status: "completed", hintsUsed: "1" }),
      withGame({ status: "completed", hintsUsed: 2 }),
    ]) {
      expect(
        dayResponseSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }

    expect(
      dayResponseSchema.safeParse(withGame({ status: "completed" })).success,
    ).toBe(true);
    expect(
      dayResponseSchema.safeParse(
        withGame({ status: "completed", elapsedMs: 61_000, hintsUsed: 1 }),
      ).success,
    ).toBe(true);

    expect(
      dayGamesFromRows([
        rowOf("sudoku", "won", true, 512_000, 1),
        rowOf("binairo", "won", true, 407_000, 0),
        rowOf("termo", "won", true, 188_000, 0),

        rowOf("nonogram", "lost", true, 99_000, 1),
      ]),
    ).toEqual({
      termo: { status: "completed" },
      sudoku: { status: "completed", elapsedMs: 512_000, hintsUsed: 1 },
      nonogram: { status: "played" },
      binairo: { status: "completed", elapsedMs: 407_000, hintsUsed: 0 },
    });

    expect(
      dayResponseSchema.safeParse({
        date: valid.date,
        games: dayGamesFromRows([rowOf("binairo", "won", true, 407_000, 1)]),
      }).success,
    ).toBe(true);
  });

  it("T-CORE-S104: the duplicate-row fold takes the LARGEST `hintsUsed` — the humbler claim, matching `elapsedMs`'s direction (#142)", () => {
    const rows: readonly DayRow[] = [
      rowOf("sudoku", "won", true, 400_000, 1),
      rowOf("sudoku", "won", true, 500_000, 0),
    ];
    const expected = {
      termo: { status: "pending" },
      sudoku: { status: "completed", elapsedMs: 500_000, hintsUsed: 1 },
      nonogram: { status: "pending" },
      binairo: { status: "pending" },
    };
    expect(dayGamesFromRows(rows)).toEqual(expected);
    expect(dayGamesFromRows([...rows].reverse())).toEqual(expected);
  });

  it("T-CORE-S112: the producer attaches `motifName` to a COMPLETED NONOGRAM claim and to no other game (#64, ADR-0070)", () => {
    const rows: readonly DayRow[] = [
      rowOf("nonogram", "won", true, 512_000, 1),
      rowOf("sudoku", "won", true, 407_000, 0),
      rowOf("termo", "won", true, 188_000, 0),
      rowOf("binairo", "won", true, 99_000, 0),
    ];
    expect(
      dayGamesFromRows(rows, { nonogramMotifName: "Âncora" }),
    ).toStrictEqual({
      termo: { status: "completed" },
      sudoku: { status: "completed", elapsedMs: 407_000, hintsUsed: 0 },
      nonogram: {
        status: "completed",
        elapsedMs: 512_000,
        hintsUsed: 1,
        motifName: "Âncora",
      },
      binairo: { status: "completed", elapsedMs: 99_000, hintsUsed: 0 },
    });

    const named = dayGamesFromRows(rows, { nonogramMotifName: "Âncora" });
    for (const game of ["termo", "sudoku", "binairo"] as const) {
      expect(Object.keys(named[game]), game).not.toContain("motifName");
    }

    expect(
      dayResponseSchema.safeParse({ date: valid.date, games: named }).success,
    ).toBe(true);
  });

  it("T-CORE-S113: no status but `completed` carries a name, and absent extras carry none — the publication rule at the producer (#64)", () => {
    const extras = { nonogramMotifName: "Âncora" };

    const cases: readonly [string, readonly DayRow[]][] = [
      ["no row at all", []],
      ["a lost row → played", [rowOf("nonogram", "lost", true, 99_000, 0)]],
      ["a late win → pending", [rowOf("nonogram", "won", false, 512_000, 1)]],
      [
        "a duplicate pair whose weakest claim is played",
        [
          rowOf("nonogram", "won", true, 512_000, 1),
          rowOf("nonogram", "lost", true, 99_000, 0),
        ],
      ],
    ];
    for (const [label, rows] of cases) {
      const claim = dayGamesFromRows(rows, extras).nonogram;
      expect(claim.status, label).not.toBe("completed");
      expect(Object.keys(claim), label).not.toContain("motifName");
      expect(claim.motifName, label).toBeUndefined();
    }

    const completed = [rowOf("nonogram", "won", true, 512_000, 1)];
    for (const extra of [
      undefined,
      {},
      { nonogramMotifName: undefined },

      { nonogramMotifName: "" },
    ]) {
      const claim = dayGamesFromRows(completed, extra).nonogram;
      expect(claim.status, JSON.stringify(extra)).toBe("completed");
      expect(Object.keys(claim), JSON.stringify(extra)).not.toContain(
        "motifName",
      );
    }
  });

  it("T-CORE-S114: the wire rejects a name on a non-completed claim and rejects an empty one — the publication rule at the schema (#64)", () => {
    const withGame = (game: unknown) => ({
      ...valid,
      games: { ...valid.games, nonogram: game },
    });
    for (const body of [
      withGame({ status: "pending", motifName: "Âncora" }),
      withGame({ status: "played", motifName: "Âncora" }),

      withGame({ status: "completed", motifName: "" }),
      withGame({ status: "completed", motifName: 7 }),
      withGame({ status: "completed", motifName: null }),
    ]) {
      expect(
        dayResponseSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }

    for (const status of DAY_STATUSES) {
      expect(
        dayResponseSchema.safeParse(withGame({ status })).success,
        status,
      ).toBe(true);
    }
    expect(
      dayResponseSchema.safeParse(
        withGame({
          status: "completed",
          elapsedMs: 512_000,
          hintsUsed: 1,
          motifName: "Âncora",
        }),
      ).success,
    ).toBe(true);

    expect(
      dayResponseSchema.safeParse({
        ...valid,
        games: {
          ...valid.games,
          termo: { status: "completed", motifName: "Âncora" },
        },
      }).success,
    ).toBe(true);
  });
});

describe("dayStateFromRows — the server's projection of one day's rows", () => {
  it("T-CORE-S87: no rows is four pendings, total over GAMES", () => {
    const state = dayStateFromRows([]);
    expect(Object.keys(state).sort()).toEqual([...GAMES].sort());
    for (const game of GAMES) {
      expect(state[game], game).toBe("pending");
    }
  });

  it("T-CORE-S88: a won on-time row is completed; a lost row is played, on time or not (ADR-0008 rule 3)", () => {
    expect(dayStateFromRows([rowOf("sudoku", "won", true)])).toEqual(
      stateOf({ sudoku: "completed" }),
    );

    for (const onTime of [true, false]) {
      expect(
        dayStateFromRows([rowOf("termo", "lost", onTime)]),
        `lost onTime=${String(onTime)}`,
      ).toEqual(stateOf({ termo: "played" }));
    }
  });

  it("T-CORE-S89: a won LATE row reads pending — unreachable today and defined anyway — and row order does not matter", () => {
    expect(dayStateFromRows([rowOf("nonogram", "won", false)])).toEqual(
      stateOf({ nonogram: "pending" }),
    );

    const rows: readonly DayRow[] = [
      rowOf("binairo", "won", true),
      rowOf("termo", "lost", true),
      rowOf("sudoku", "won", false),
    ];
    const expected = stateOf({ binairo: "completed", termo: "played" });
    expect(dayStateFromRows(rows)).toEqual(expected);
    expect(dayStateFromRows([...rows].reverse())).toEqual(expected);
  });

  it("T-CORE-S96: TWO ROWS FOR ONE GAME take the WEAKEST claim, in either order — the fold's documented rule, exercised", () => {
    const strongerFirst: readonly DayRow[] = [
      rowOf("termo", "won", true),
      rowOf("termo", "lost", true),
    ];
    expect(dayStateFromRows(strongerFirst)).toEqual(
      stateOf({ termo: "played" }),
    );
    expect(dayStateFromRows([...strongerFirst].reverse())).toEqual(
      stateOf({ termo: "played" }),
    );

    const withLateWin: readonly DayRow[] = [
      rowOf("sudoku", "won", false),
      rowOf("sudoku", "won", true),
    ];
    expect(dayStateFromRows(withLateWin)).toEqual(stateOf({}));
    expect(dayStateFromRows([...withLateWin].reverse())).toEqual(stateOf({}));
  });

  it("T-CORE-S97: property — `dayStateFromRows` is PERMUTATION-INVARIANT over an ARBITRARY row array, duplicates included", () => {
    const rowArb: fc.Arbitrary<DayRow> = fc.record({
      game: fc.constantFrom(...GAMES),
      outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
      onTime: fc.boolean(),
      elapsedMs: fc.nat({ max: 86_400_000 }),

      hintsUsed: fc.nat({ max: 1 }),
    });
    const rowsAndPermutation = fc
      .array(rowArb, { maxLength: 12 })
      .chain((rows) =>
        fc.tuple(
          fc.constant(rows),

          fc.shuffledSubarray(rows, {
            minLength: rows.length,
            maxLength: rows.length,
          }),
        ),
      );
    fc.assert(
      fc.property(rowsAndPermutation, ([rows, permuted]) => {
        expect(dayStateFromRows(permuted)).toEqual(dayStateFromRows(rows));

        expect(dayGamesFromRows(permuted)).toEqual(dayGamesFromRows(rows));
      }),
      { numRuns: 100 },
    );
  });
});

describe("the merge invariant (ADR-0060 decision 3)", () => {
  it("T-CORE-S90: the full 3 x 3 table — server `pending` returns local, every other server value returns itself", () => {
    for (const local of ALL_STATUSES) {
      for (const server of ALL_STATUSES) {
        expect(mergeDayStatus(local, server), `${local} + ${server}`).toBe(
          server === "pending" ? local : server,
        );
      }
    }

    expect(mergeDayStatus("pending", "completed")).toBe("completed");
    expect(mergeDayStatus("completed", "pending")).toBe("completed");
    expect(mergeDayStatus("completed", "played")).toBe("played");
    expect(mergeDayStatus("played", "completed")).toBe("completed");
  });

  it("T-CORE-S91: property — the merge is total, idempotent, `pending` only when both inputs are, and the SERVER's claim ABSORBS the device's", () => {
    fc.assert(
      fc.property(statusArb, statusArb, (local, server) => {
        const merged = mergeDayStatus(local, server);
        expect(ALL_STATUSES).toContain(merged);

        expect(mergeDayStatus(merged, server)).toBe(merged);

        expect(merged === "pending").toBe(
          local === "pending" && server === "pending",
        );
      }),
      { numRuns: 100 },
    );

    //

    fc.assert(
      fc.property(statusArb, statusArb, statusArb, (localA, localB, server) => {
        if (server === "pending") {
          expect(mergeDayStatus(localA, server)).toBe(localA);
          expect(mergeDayStatus(localB, server)).toBe(localB);
        } else {
          expect(mergeDayStatus(localA, server)).toBe(
            mergeDayStatus(localB, server),
          );
        }
      }),
      { numRuns: 100 },
    );

    expect(mergeDayStatus("completed", "played")).not.toBe("completed");
  });

  it("T-CORE-S92: property — `mergeDayState` is POINTWISE: game g's answer depends on no other game's status", () => {
    fc.assert(
      fc.property(
        stateArb,
        stateArb,
        stateArb,
        stateArb,
        fc.constantFrom(...GAMES),
        (local, server, otherLocal, otherServer, game) => {
          const localB = withStatus(otherLocal, game, local[game]);
          const serverB = withStatus(otherServer, game, server[game]);
          expect(mergeDayState(local, server)[game]).toBe(
            mergeDayState(localB, serverB)[game],
          );
          expect(mergeDayState(local, server)[game]).toBe(
            mergeDayStatus(local[game], server[game]),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("the day projection and the streak agree (cross-endpoint)", () => {
  function isoOf(epochDay: number): string {
    return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
  }

  const DAY_MIN = 18_262;
  const DAY_MAX = 22_279;

  interface Seeded {
    readonly today: string;
    readonly rows: readonly (StreakRow & { readonly game: Game })[];
  }

  const seededArb: fc.Arbitrary<Seeded> = fc
    .integer({ min: DAY_MIN + 40, max: DAY_MAX })
    .chain((todayDay) =>
      fc.record({
        today: fc.constant(isoOf(todayDay)),

        rows: fc.uniqueArray(
          fc.record({
            game: fc.constantFrom(...GAMES),
            date: fc
              .integer({ min: todayDay - 10, max: todayDay })
              .map((day) => isoOf(day)),
            outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
            onTime: fc.boolean(),
          }),
          {
            maxLength: 20,
            selector: (row) => `${row.game}|${row.date}`,
          },
        ),
      }),
    );

  it("T-CORE-S93: property — `todayCounts` holds exactly when some game reads `completed` for today", () => {
    fc.assert(
      fc.property(seededArb, ({ today, rows }) => {
        const streak = computeStreak(rows, today);
        const day = dayStateFromRows(
          rows
            .filter((row) => row.date === today)
            .map(({ game, outcome, onTime }) => ({
              game,
              outcome,
              onTime,
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            })),
        );
        const someCompleted = GAMES.some((game) => day[game] === "completed");

        expect(someCompleted).toBe(streak.todayCounts);
      }),
      { numRuns: 100 },
    );
  });
});
