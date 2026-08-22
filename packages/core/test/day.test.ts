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

/**
 * The day payload's contract and the merge discipline as pure functions
 * (#83, ADR-0060). ONE FILE rather than the `-contract` / `-properties`
 * split most of this suite uses, on `date.test.ts`'s precedent: the whole
 * subject is ~120 lines of source and splitting it three ways would put the
 * enum's shape, its arithmetic and its properties in three files that only
 * ever change together.
 *
 * The properties run at `numRuns: 100` — ADR-0023's floor for a main
 * property, which is what all three of these are.
 */

const ALL_STATUSES: readonly DayGameStatus[] = DAY_STATUSES;

/** A day state written as a literal, for the tables below. */
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

/** One game's status replaced, the rest untouched — total by construction. */
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

/** A row's stored duration — every row has one, the column is NOT NULL. */
const ELAPSED_MS = 61_000;

/** A completion row with the duration the fixtures do not care about. */
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
      // A completed Termo carries NO duration (ADR-0045 decision 4) — the
      // one completed shape whose claim is the status alone.
      termo: { status: "completed" },
      sudoku: { status: "pending" },
      nonogram: { status: "played" },
      binairo: { status: "completed", elapsedMs: 407_000, hintsUsed: 1 },
    },
  };

  it("T-CORE-S86: strict on both ends — unknown keys, a missing game, an unknown status and a malformed date all fail", () => {
    expect(dayResponseSchema.parse(valid)).toEqual(valid);

    const malformed: readonly unknown[] = [
      // An unknown TOP-LEVEL key: the growth ADR-0048 decision 3 refuses.
      { ...valid, streak: 3 },
      // An unknown key inside `games` — a fifth game, or a leaked field.
      { ...valid, games: { ...valid.games, xadrez: { status: "pending" } } },
      // An unknown key inside one game's claim.
      {
        ...valid,
        games: {
          ...valid.games,
          sudoku: { status: "pending", onTime: true },
        },
      },
      // A MISSING game: the map is total or it is not an answer.
      {
        date: valid.date,
        games: {
          termo: { status: "completed" },
          sudoku: { status: "pending" },
          nonogram: { status: "played" },
        },
      },
      // A verb outside the vocabulary.
      { ...valid, games: { ...valid.games, sudoku: { status: "late" } } },
      // The pre-#141 wire spelling — a bare status string is not a claim.
      { ...valid, games: { ...valid.games, sudoku: "pending" } },
      // Shape-checked date (`isoDateString`), like every server-derived one.
      { ...valid, date: "19/08/2026" },
      { ...valid, date: "2026-8-19" },
      // `games` is required and is an object.
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
    // And each game's claim is exactly {status, elapsedMs, hintsUsed,
    // motifName} (#141, widened at #142, widened again at #64) — a FIFTH
    // field is this tripwire's business before it is anyone's feature.
    //
    // DELIBERATELY REWRITTEN IN PLACE AT #64, id kept: this tripwire fired
    // exactly as designed when `motifName` landed, and the correct response
    // to a tripwire that fires for a decided reason is to restate its claim
    // at the new value, never to loosen it into a `toContain`.
    //
    // The residual this pins is named rather than hidden (ADR-0070): the
    // list is asserted for ALL FOUR games because all four share
    // `dayGameStateSchema`, so `motifName` is wire-LEGAL on termo, sudoku
    // and binairo too. Only `dayGamesFromRows` scopes it to nonogram — the
    // same producer-side arrangement as Termo's duration suppression.
    for (const game of GAMES) {
      expect(
        Object.keys(dayResponseSchema.shape.games.shape[game].shape).sort(),
        game,
      ).toEqual(["elapsedMs", "hintsUsed", "motifName", "status"]);
    }

    // Nothing about a puzzle can be added without reddening this: the two
    // assertions above pin the key set, and the scan below pins the ban on
    // the leak keys every daily payload is measured against.
    //
    // The scan below still passes ON MERIT at #64, which is the point of
    // ADR-0033 decision 4's rename route: `"name"` is still banned and
    // `motifName` is not it, so nothing here was relaxed to let the feature
    // through. `motifId`, `mirrored` and `solution` stay banned outright.
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
    // Re-aimed at #141: the per-game value grew into a claim object, and the
    // enum it was always about now sits on that claim's `status`.
    expect(
      dayResponseSchema.shape.games.shape.termo.shape.status.options,
    ).toEqual([...DAY_STATUSES]);
  });

  it("T-CORE-S99: a claim carries `elapsedMs` only when completed, and the producer publishes it for completed grid games and never for Termo (#141)", () => {
    // ONE id, one claim about what a per-game claim may carry, asserted at
    // both ends of the seam — the schema that parses it and the projection
    // that produces it (the T-WEB-S217 flagged-rather-than-split precedent).

    // The schema end: a duration on a game nobody completed is a PARSE
    // FAILURE, not a value a client has to decide about. So are a negative,
    // a fractional, a non-numeric and an over-24 h duration — the last
    // matching the cap every completion WRITE contract already enforces, so
    // the read side never accepts what the write side would have refused.
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
    // A completed claim WITHOUT a duration stays legal — the chip-only done
    // tile is a shipped honest state, and Termo's only completed shape.
    expect(
      dayResponseSchema.safeParse(withGame({ status: "completed" })).success,
    ).toBe(true);

    // The producer end: the completed grid row's duration is published, and
    // neither a played nor a pending game carries one — a lost row and a
    // late-win row both have a real stored `elapsedMs`, and publishing
    // either would put a time on a game the day does not count.
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

    // A completed TERMO publishes none either (ADR-0045 decision 4): its
    // stored duration is real and meaningless, and the local reader's
    // `entryFor` makes the same exception — mirroring it is what keeps a
    // cross-device Termo tile identical to a local one (`em 4/6` from
    // `/stats`, never a clock).
    expect(dayGamesFromRows([rowOf("termo", "won", true, 188_000)])).toEqual({
      termo: { status: "completed" },
      sudoku: { status: "pending" },
      nonogram: { status: "pending" },
      binairo: { status: "pending" },
    });

    // And the producer's output PARSES under the wire schema — the two ends
    // of this id agree with each other, not just with this test.
    expect(
      dayResponseSchema.safeParse({
        date: valid.date,
        games: dayGamesFromRows([rowOf("binairo", "won", true, 407_000)]),
      }).success,
    ).toBe(true);
  });

  it("T-CORE-S103: a claim carries `hintsUsed` only when completed, and the producer publishes it for completed grid games and never for Termo (#142)", () => {
    // T-CORE-S99's shape exactly, one field over: both ends of the seam —
    // the schema that parses the claim and the projection that produces it.

    // The schema end: a hint count on a game nobody completed is a PARSE
    // FAILURE, and so are a negative, a fractional, a non-numeric and an
    // over-cap count — `.max(1)` mirrors the write contracts (one free hint
    // per puzzle, plan 017 D21), so the read side never accepts what the
    // write side would have refused to store.
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
    // A completed claim WITHOUT a hint count stays legal — the deploy-skew
    // shape (an old server behind a new client) and Termo's only completed
    // shape. So does time-with-hints, hints alone being the degenerate case
    // the per-line stamp rule covers.
    expect(
      dayResponseSchema.safeParse(withGame({ status: "completed" })).success,
    ).toBe(true);
    expect(
      dayResponseSchema.safeParse(
        withGame({ status: "completed", elapsedMs: 61_000, hintsUsed: 1 }),
      ).success,
    ).toBe(true);

    // The producer end: a completed grid row's stored count is published —
    // 0 and 1 both, so "published" is pinned rather than "defaulted" — and
    // neither a played game nor a completed TERMO ever carries one. Termo
    // ships no hint (ADR-0045 decision 1): "sem dicas" is not a virtue where
    // a hint was never possible.
    expect(
      dayGamesFromRows([
        rowOf("sudoku", "won", true, 512_000, 1),
        rowOf("binairo", "won", true, 407_000, 0),
        rowOf("termo", "won", true, 188_000, 0),
        // A lost row's stored count is real and publishes nothing — the
        // signature admits it even where the schema cannot produce it.
        rowOf("nonogram", "lost", true, 99_000, 1),
      ]),
    ).toEqual({
      termo: { status: "completed" },
      sudoku: { status: "completed", elapsedMs: 512_000, hintsUsed: 1 },
      nonogram: { status: "played" },
      binairo: { status: "completed", elapsedMs: 407_000, hintsUsed: 0 },
    });

    // And the producer's output PARSES under the wire schema — the two ends
    // agree with each other, not just with this test.
    expect(
      dayResponseSchema.safeParse({
        date: valid.date,
        games: dayGamesFromRows([rowOf("binairo", "won", true, 407_000, 1)]),
      }).success,
    ).toBe(true);
  });

  it("T-CORE-S104: the duplicate-row fold takes the LARGEST `hintsUsed` — the humbler claim, matching `elapsedMs`'s direction (#142)", () => {
    // Impossible by the composite primary key, and defined anyway like the
    // status fold (T-CORE-S96's argument): the never-overstate direction
    // here is "more hints", so a duplicate pair publishes the larger count.
    // Both orders, so this pins "max" and not merely "the last row wins".
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
    // The name is not a field of any row — it is curated daily content the
    // caller read from behind the publication wall and handed in. So this
    // pins the two halves of the producer's rule together: the game it
    // lands on, and the games it does not.
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

    // `toStrictEqual` above is doing real work and is not stylistic:
    // `toEqual` treats a present-but-undefined key as absent, which is
    // exactly the distinction the spread-per-field discipline exists to
    // protect (the wire schema is strict and `sameGame` compares claims
    // field for field). Asserted again, directly, so the reason survives a
    // future matcher swap.
    const named = dayGamesFromRows(rows, { nonogramMotifName: "Âncora" });
    for (const game of ["termo", "sudoku", "binairo"] as const) {
      expect(Object.keys(named[game]), game).not.toContain("motifName");
    }

    // And the producer's output PARSES under the wire schema — the two ends
    // agree with each other, not just with this test.
    expect(
      dayResponseSchema.safeParse({ date: valid.date, games: named }).success,
    ).toBe(true);
  });

  it("T-CORE-S113: no status but `completed` carries a name, and absent extras carry none — the publication rule at the producer (#64)", () => {
    const extras = { nonogramMotifName: "Âncora" };
    // Every non-completed shape a nonogram row can take, each fed the SAME
    // extras: the caller supplies a string and this fold decides whether a
    // claim may carry it. `pending` from no row at all, `played` from a lost
    // row, and `pending` from the LATE WIN — the row that exists and still
    // yields no claim (ADR-0060 consequence (f)).
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

    // Absent extras on a genuinely completed nonogram: the honest degraded
    // case — a killed row, an unpublished day, a parse failure or a blank
    // stored name all arrive as `undefined` and the claim simply has no
    // name. It is progressive enhancement, never a fabricated value.
    const completed = [rowOf("nonogram", "won", true, 512_000, 1)];
    for (const extra of [
      undefined,
      {},
      { nonogramMotifName: undefined },
      // The empty and whitespace-only names the wall read normalises. The
      // fold guards on TRUTHINESS anyway, because `motifName: ""` would fail
      // the schema's `.min(1)` inside the route's own parse and 500 the
      // WHOLE day payload — the ADR-0065 `hintsUsed`-cap failure verbatim.
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
      // The publication rule: a name on a game nobody completed is a PARSE
      // FAILURE, not a value the client has to decide about. This is the
      // ADR-0004 guarantee at the contract, independent of the producer.
      withGame({ status: "pending", motifName: "Âncora" }),
      withGame({ status: "played", motifName: "Âncora" }),
      // `.min(1)`: an empty name is not a name. The producer normalises it
      // away, and the wire refuses it even if a producer ever forgot to.
      withGame({ status: "completed", motifName: "" }),
      withGame({ status: "completed", motifName: 7 }),
      withGame({ status: "completed", motifName: null }),
    ]) {
      expect(
        dayResponseSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }

    // Its ABSENCE is legal on every status, on every game — the field is
    // optional, so today's payloads and a deploy-skewed old server both
    // still parse.
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

    // THE RESIDUAL, asserted rather than only described (ADR-0070): all four
    // games share `dayGameStateSchema`, so a name is wire-LEGAL on a
    // completed termo, sudoku or binairo claim. Only `dayGamesFromRows`
    // scopes it to nonogram (T-CORE-S112). A `superRefine` on
    // `dayResponseSchema.games` would close this at the schema; it was
    // declined, and this assertion is the record of what that costs.
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
    // Impossible by the composite primary key `(user_id, game, date)`, and
    // `dayStateFromRows` defines it anyway (see the function's doc). Until
    // this case existed, `STATUS_CLAIM[status] < STATUS_CLAIM[weakest]` was
    // never evaluated — `weakest` was `undefined` on the only iteration that
    // ever ran — so flipping `<` to `>` (STRONGEST wins, the exact opposite
    // of the documented never-overstate direction ADR-0031 decision 2
    // permits) left the whole file green. Both orders, so this pins
    // "weakest" and not merely "the last row wins".
    const strongerFirst: readonly DayRow[] = [
      rowOf("termo", "won", true), // completed
      rowOf("termo", "lost", true), // played
    ];
    expect(dayStateFromRows(strongerFirst)).toEqual(
      stateOf({ termo: "played" }),
    );
    expect(dayStateFromRows([...strongerFirst].reverse())).toEqual(
      stateOf({ termo: "played" }),
    );

    // And `pending` is weaker than `played`, which is the other edge of
    // `STATUS_CLAIM`'s order and the one a `>` flip also inverts.
    const withLateWin: readonly DayRow[] = [
      rowOf("sudoku", "won", false), // pending
      rowOf("sudoku", "won", true), // completed
    ];
    expect(dayStateFromRows(withLateWin)).toEqual(stateOf({}));
    expect(dayStateFromRows([...withLateWin].reverse())).toEqual(stateOf({}));
  });

  it("T-CORE-S97: property — `dayStateFromRows` is PERMUTATION-INVARIANT over an ARBITRARY row array, duplicates included", () => {
    // The claim the function's doc and plan 056 §8 both make, quantified
    // rather than asserted: no uniqueness selector, so the generator really
    // does produce two and three rows for one game, which is what makes the
    // weakest-claim fold observable. `T-CORE-S93`'s generator deliberately
    // excludes duplicates (it quantifies over states the database can hold);
    // this one deliberately includes them (it quantifies over what the
    // function's signature admits). The two are complementary, not rivals.
    const rowArb: fc.Arbitrary<DayRow> = fc.record({
      game: fc.constantFrom(...GAMES),
      outcome: fc.constantFrom(...COMPLETION_OUTCOMES),
      onTime: fc.boolean(),
      elapsedMs: fc.nat({ max: 86_400_000 }),
      // The write contracts cap the stored count at 1 (#142); the fold's
      // `max` needs both values reachable to be observable.
      hintsUsed: fc.nat({ max: 1 }),
    });
    const rowsAndPermutation = fc
      .array(rowArb, { maxLength: 12 })
      .chain((rows) =>
        fc.tuple(
          fc.constant(rows),
          // A FULL shuffle, not a subarray: min = max = the array's own
          // length, so every draw is a genuine permutation of the same rows.
          fc.shuffledSubarray(rows, {
            minLength: rows.length,
            maxLength: rows.length,
          }),
        ),
      );
    fc.assert(
      fc.property(rowsAndPermutation, ([rows, permuted]) => {
        expect(dayStateFromRows(permuted)).toEqual(dayStateFromRows(rows));
        // Widened at #141, no new id (the T-WEB-S100 burn precedent): the
        // claim producer composes the same fold and makes the same doc-level
        // promise, duration selection included — `max` is what keeps the
        // published time order-blind.
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

    // The four cases the ticket is actually about, spelled out so a reader
    // does not have to evaluate the loop above in their head.
    expect(mergeDayStatus("pending", "completed")).toBe("completed"); // cross-device done
    expect(mergeDayStatus("completed", "pending")).toBe("completed"); // queued or just finished
    expect(mergeDayStatus("completed", "played")).toBe("played"); // the DEMOTION
    expect(mergeDayStatus("played", "completed")).toBe("completed"); // the PROMOTION
  });

  it("T-CORE-S91: property — the merge is total, idempotent, `pending` only when both inputs are, and the SERVER's claim ABSORBS the device's", () => {
    fc.assert(
      fc.property(statusArb, statusArb, (local, server) => {
        const merged = mergeDayStatus(local, server);
        expect(ALL_STATUSES).toContain(merged);
        // Idempotent: re-merging the answer against the same server claim
        // is a fixed point, so a second hydration cannot drift.
        expect(mergeDayStatus(merged, server)).toBe(merged);
        // `pending` out only when nobody claimed anything.
        expect(merged === "pending").toBe(
          local === "pending" && server === "pending",
        );
      }),
      { numRuns: 100 },
    );

    // THE DIRECTION, as a DERIVED property rather than a restatement of the
    // one-line expression — and the one sub-property the inverted merge
    // (`local === "pending" ? server : local`, the device winning wherever it
    // claims anything) does NOT satisfy. The three above all hold of it:
    // totality, idempotence and "pending iff both" are direction-blind, so
    // until this existed only the tables in T-CORE-S90 and T-WEB-S236
    // discriminated the invariant at all.
    //
    // ABSORPTION: where the server claims, the device's status is not an
    // input — two different locals against one non-`pending` server give the
    // same answer. The mirror, where the server does not claim, the SERVER's
    // status is not an input.
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

    // And the concrete consequence the never-overstate direction turns on: a
    // device `completed` against a server `played` never answers `completed`.
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
          // Two whole payloads that agree on `game` and may differ
          // everywhere else must agree on `game` after the merge. That is
          // what makes the caller's date precondition — the payload is
          // discarded IN FULL — the only whole-payload rule in the merge.
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
  /** Whole days since the epoch → 'YYYY-MM-DD' (streak-properties' inverse). */
  function isoOf(epochDay: number): string {
    return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
  }

  const DAY_MIN = 18_262; // 2020-01-01
  const DAY_MAX = 22_279; // 2030-12-31

  interface Seeded {
    readonly today: string;
    readonly rows: readonly (StreakRow & { readonly game: Game })[];
  }

  const seededArb: fc.Arbitrary<Seeded> = fc
    .integer({ min: DAY_MIN + 40, max: DAY_MAX })
    .chain((todayDay) =>
      fc.record({
        today: fc.constant(isoOf(todayDay)),
        // UNIQUE ON (game, date), because the completions primary key is
        // `(user_id, game, date)`: a generator that produced two rows for
        // one game and one day would be quantifying over a state the
        // database cannot hold. `T-CORE-S97` is the complement and quantifies
        // over exactly that state, because `dayStateFromRows`'s SIGNATURE
        // admits it and its doc makes a claim about it; this property is
        // about what the DATABASE can hand the route, which is narrower.
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
        // The hub's "X de 4 >= 1" and the streak's "maintained today" can
        // never disagree — two endpoints, one rule.
        expect(someCompleted).toBe(streak.todayCounts);
      }),
      { numRuns: 100 },
    );
  });
});
