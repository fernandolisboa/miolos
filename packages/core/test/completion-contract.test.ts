import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  binairoCompletionRequestSchema,
  calendarDateString,
  completionRequestSchema,
  completionResponseSchema,
  nonogramCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  type BinairoCompletionRequest,
  type CompletionResponse,
  type NonogramCompletionRequest,
  type SudokuCompletionRequest,
} from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

/** A rule-irrelevant but well-typed 64-cell grid — the schema checks shape, never binairo rules. */
const grid: BinairoCompletionRequest["grid"] = Array.from(
  { length: 64 },
  (_unused, index): 0 | 1 => (index % 2 === 0 ? 0 : 1),
);

const valid: BinairoCompletionRequest = {
  game: "binairo",
  date: "2026-08-01",
  grid,
  elapsedMs: 272_000,
  hintsUsed: 1,
};

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Rule-irrelevant but well-typed 81 digits — the schema checks shape, never sudoku rules. */
const sudokuGrid: SudokuCompletionRequest["grid"] = Array.from(
  { length: 81 },
  (_unused, index) => DIGITS[index % 9] ?? 1,
);

const validSudoku: SudokuCompletionRequest = {
  game: "sudoku",
  date: "2026-08-01",
  grid: sudokuGrid,
  elapsedMs: 272_000,
  hintsUsed: 1,
};

/**
 * The four legal board areas. A nonogram is the first game whose board size
 * changes daily, so unlike binairo's 64 and sudoku's 81 there is no single
 * legal length — the SET is the contract (plan 020 P4).
 */
const NONOGRAM_SIZES = [5, 8, 10, 15] as const;

/**
 * A rule-irrelevant but well-typed picture bitmap — the schema checks shape,
 * never nonogram rules. `1` = filled, `0` = crossed or untouched
 * indistinguishably (ADR-0032).
 */
function nonogramGrid(size: number): NonogramCompletionRequest["grid"] {
  return Array.from({ length: size * size }, (_unused, index): 0 | 1 =>
    index % 3 === 0 ? 1 : 0,
  );
}

const validNonogram: NonogramCompletionRequest = {
  game: "nonogram",
  date: "2026-08-01",
  grid: nonogramGrid(5),
  elapsedMs: 272_000,
  hintsUsed: 1,
};

describe("binairoCompletionRequestSchema", () => {
  it("parses and round-trips a valid submission", () => {
    expect(binairoCompletionRequestSchema.parse(valid)).toEqual(valid);
    expect(completionRequestSchema.parse(valid)).toEqual(valid);
  });

  it("rejects an extra key (strictObject — a smuggled field never reaches the route)", () => {
    const smuggled = {
      ...valid,
      userId: "3f8e9a2c-1b4d-4e6f-8a9b-0c1d2e3f4a5b",
    };
    expect(binairoCompletionRequestSchema.safeParse(smuggled).success).toBe(
      false,
    );
    expect(completionRequestSchema.safeParse(smuggled).success).toBe(false);
  });

  it("drops a JSON `__proto__` key instead of rejecting it, and carries none of it through (T-CORE-S16)", () => {
    // The one exception to the strictness the schema's TSDoc claims, pinned
    // rather than argued (step-6 round-4 finding
    // `strictobject-silently-drops-a-json-proto-key`). `JSON.parse` makes
    // `__proto__` an OWN enumerable property, but Zod's unrecognized-key
    // check asks `"__proto__" in shape`, which is true for every object
    // literal — so this body PARSES.
    // Built as a STRING and parsed, because an object literal's `__proto__`
    // sets the prototype instead of adding a key — the hazard only exists on
    // the wire.
    const body: unknown = JSON.parse(
      `{"__proto__":{"polluted":true},${JSON.stringify(valid).slice(1)}`,
    );
    // Anti-vacuity: the key really did survive JSON.parse as an own key, or
    // this test proves nothing about Zod.
    expect(Object.prototype.hasOwnProperty.call(body, "__proto__")).toBe(true);

    const parsed = binairoCompletionRequestSchema.safeParse(body);

    expect(parsed.success).toBe(true);
    // What makes it harmless: the output is a fresh object with only the
    // five declared keys, so no client value survives the parse — the
    // no-timestamp guarantee holds by construction rather than by strictness.
    expect(Object.keys(parsed.success ? parsed.data : {}).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
    expect("polluted" in Object.prototype).toBe(false);

    // And every OTHER smuggled key is still rejected, `constructor` included
    // — the sentence in the TSDoc is narrowed by exactly one name.
    expect(
      binairoCompletionRequestSchema.safeParse({
        ...valid,
        constructor: "x",
      }).success,
    ).toBe(false);
  });

  it("rejects a 63-length grid", () => {
    const short = { ...valid, grid: grid.slice(0, 63) };
    expect(binairoCompletionRequestSchema.safeParse(short).success).toBe(false);
  });

  it("rejects a null cell (a submission is a COMPLETE grid, never a partial one)", () => {
    const withHole = { ...valid, grid: [null, ...grid.slice(1)] };
    expect(binairoCompletionRequestSchema.safeParse(withHole).success).toBe(
      false,
    );
  });

  it("rejects a negative elapsedMs", () => {
    expect(
      binairoCompletionRequestSchema.safeParse({ ...valid, elapsedMs: -1 })
        .success,
    ).toBe(false);
  });

  it("rejects an elapsedMs above one day (the column can never be widened by a body)", () => {
    expect(
      binairoCompletionRequestSchema.safeParse({
        ...valid,
        elapsedMs: 86_400_001,
      }).success,
    ).toBe(false);
    expect(
      binairoCompletionRequestSchema.safeParse({
        ...valid,
        elapsedMs: 86_400_000,
      }).success,
    ).toBe(true);
  });

  it("rejects a non-integer elapsedMs", () => {
    expect(
      binairoCompletionRequestSchema.safeParse({ ...valid, elapsedMs: 1.5 })
        .success,
    ).toBe(false);
  });

  it("rejects hintsUsed: 2 — v1 grants exactly one free hint per puzzle (plan 017 D21)", () => {
    expect(
      binairoCompletionRequestSchema.safeParse({ ...valid, hintsUsed: 2 })
        .success,
    ).toBe(false);
    expect(
      binairoCompletionRequestSchema.safeParse({ ...valid, hintsUsed: 0 })
        .success,
    ).toBe(true);
  });

  // Retargeted twice, each time at the game the union genuinely does not
  // carry: `sudoku` at #18, `nonogram` at #23, and now `termo` at #25. The
  // retarget is not tidying — with nonogram in the union this assertion was
  // ACTIVELY FALSE against it, because a 64-cell 0/1 body IS a legal 8x8
  // nonogram submission (plan 020 N31). Termo has no grid at all (#27).
  it("rejects a game the union does not carry yet (#27 widens it)", () => {
    expect(
      completionRequestSchema.safeParse({ ...valid, game: "termo" }).success,
    ).toBe(false);
  });
});

describe("nonogramCompletionRequestSchema", () => {
  // T-CORE-S13 (plan 020 §19).
  it.each(NONOGRAM_SIZES)(
    "parses and round-trips a %i-class submission",
    (size) => {
      const body = { ...validNonogram, grid: nonogramGrid(size) };
      expect(nonogramCompletionRequestSchema.parse(body)).toEqual(body);
      expect(completionRequestSchema.parse(body)).toEqual(body);
    },
  );

  it("rejects an extra key (strictObject — a smuggled field never reaches the route)", () => {
    const smuggled = {
      ...validNonogram,
      userId: "3f8e9a2c-1b4d-4e6f-8a9b-0c1d2e3f4a5b",
    };
    expect(nonogramCompletionRequestSchema.safeParse(smuggled).success).toBe(
      false,
    );
    expect(completionRequestSchema.safeParse(smuggled).success).toBe(false);
  });

  it("rejects a `size` key — there is no size on the wire (P4)", () => {
    // A `size` field would be a second place for the client to lie and would
    // still not be authoritative: the STORED row's solution decides the size.
    const withSize = { ...validNonogram, size: 5 };
    expect(nonogramCompletionRequestSchema.safeParse(withSize).success).toBe(
      false,
    );
  });

  it("rejects a 63-length grid — 63 is no board's area", () => {
    const short = { ...validNonogram, grid: nonogramGrid(8).slice(0, 63) };
    expect(nonogramCompletionRequestSchema.safeParse(short).success).toBe(
      false,
    );
  });

  it("rejects an 81-length grid — sudoku's area is not a nonogram's", () => {
    // The sharpest case: 81 is a perfect square and a legal length for the
    // OTHER square-boarded game, so a length-free array would accept it.
    const sudokuShaped = {
      ...validNonogram,
      grid: Array.from({ length: 81 }, (_unused, index): 0 | 1 =>
        index % 2 === 0 ? 0 : 1,
      ),
    };
    expect(
      nonogramCompletionRequestSchema.safeParse(sudokuShaped).success,
    ).toBe(false);
  });

  it("rejects a null cell (a submission is a COMPLETE picture, never a partial one)", () => {
    // `null` is the client's "undecided"; it never crosses the wire, because
    // a finished picture has no undecided cell left in it (ADR-0032).
    const withHole = {
      ...validNonogram,
      grid: [null, ...validNonogram.grid.slice(1)],
    };
    expect(nonogramCompletionRequestSchema.safeParse(withHole).success).toBe(
      false,
    );
  });

  it("rejects a non-0/1 cell — a cross is 0 on the wire, never a third value", () => {
    const threeState = {
      ...validNonogram,
      grid: [2, ...validNonogram.grid.slice(1)],
    };
    expect(nonogramCompletionRequestSchema.safeParse(threeState).success).toBe(
      false,
    );
  });

  it("rejects hintsUsed: 2 — v1 grants exactly one free hint per puzzle (plan 017 D21)", () => {
    expect(
      nonogramCompletionRequestSchema.safeParse({
        ...validNonogram,
        hintsUsed: 2,
      }).success,
    ).toBe(false);
    expect(
      nonogramCompletionRequestSchema.safeParse({
        ...validNonogram,
        hintsUsed: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative, an over-cap and a non-integer elapsedMs", () => {
    expect(
      nonogramCompletionRequestSchema.safeParse({
        ...validNonogram,
        elapsedMs: -1,
      }).success,
    ).toBe(false);
    expect(
      nonogramCompletionRequestSchema.safeParse({
        ...validNonogram,
        elapsedMs: 86_400_001,
      }).success,
    ).toBe(false);
    expect(
      nonogramCompletionRequestSchema.safeParse({
        ...validNonogram,
        elapsedMs: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects the impossible date the shape regex alone accepts", () => {
    expect(
      nonogramCompletionRequestSchema.safeParse({
        ...validNonogram,
        date: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});

describe("sudokuCompletionRequestSchema", () => {
  // T-CORE-S5 (plan 018 §15).
  it("parses and round-trips a valid submission", () => {
    expect(sudokuCompletionRequestSchema.parse(validSudoku)).toEqual(
      validSudoku,
    );
    expect(completionRequestSchema.parse(validSudoku)).toEqual(validSudoku);
  });

  it("rejects an extra key (strictObject — a smuggled field never reaches the route)", () => {
    const smuggled = {
      ...validSudoku,
      userId: "3f8e9a2c-1b4d-4e6f-8a9b-0c1d2e3f4a5b",
    };
    expect(sudokuCompletionRequestSchema.safeParse(smuggled).success).toBe(
      false,
    );
    expect(completionRequestSchema.safeParse(smuggled).success).toBe(false);
  });

  it("rejects an 80-length grid", () => {
    const short = { ...validSudoku, grid: sudokuGrid.slice(0, 80) };
    expect(sudokuCompletionRequestSchema.safeParse(short).success).toBe(false);
  });

  it("rejects a 0 cell (a submission is a COMPLETE grid, never a partial one)", () => {
    // 0 is `SudokuGrid`'s empty sentinel, so it is excluded here for exactly
    // the reason `null` is excluded from binairo's.
    const withHole = { ...validSudoku, grid: [0, ...sudokuGrid.slice(1)] };
    expect(sudokuCompletionRequestSchema.safeParse(withHole).success).toBe(
      false,
    );
  });

  it("rejects a negative, an over-cap and a non-integer elapsedMs", () => {
    expect(
      sudokuCompletionRequestSchema.safeParse({ ...validSudoku, elapsedMs: -1 })
        .success,
    ).toBe(false);
    expect(
      sudokuCompletionRequestSchema.safeParse({
        ...validSudoku,
        elapsedMs: 86_400_001,
      }).success,
    ).toBe(false);
    expect(
      sudokuCompletionRequestSchema.safeParse({
        ...validSudoku,
        elapsedMs: 86_400_000,
      }).success,
    ).toBe(true);
    expect(
      sudokuCompletionRequestSchema.safeParse({
        ...validSudoku,
        elapsedMs: 1.5,
      }).success,
    ).toBe(false);
  });

  it("rejects hintsUsed: 2 — v1 grants exactly one free hint per puzzle (plan 017 D21)", () => {
    expect(
      sudokuCompletionRequestSchema.safeParse({ ...validSudoku, hintsUsed: 2 })
        .success,
    ).toBe(false);
    expect(
      sudokuCompletionRequestSchema.safeParse({ ...validSudoku, hintsUsed: 0 })
        .success,
    ).toBe(true);
  });

  it("rejects the impossible date the shape regex alone accepts", () => {
    expect(
      sudokuCompletionRequestSchema.safeParse({
        ...validSudoku,
        date: "2026-02-30",
      }).success,
    ).toBe(false);
  });
});

describe("calendarDateString", () => {
  // The shape regex alone passes every one of these straight into an
  // `eq(dailyPuzzles.date, date)` against a Postgres `date` column, where
  // they raise 22008 — a 500 from a two-character body edit.
  //
  // `0000-01-01` and `0000-12-31` are step-6 round-4's addition (finding
  // `calendar-date-year-zero-500s-the-completions-route`): JS has a year 0
  // and the proleptic Gregorian calendar Postgres implements does not, so
  // they survive the UTC round trip verbatim while real Postgres rejects
  // them. They sit next to `0000-00-00`, which was already refused but only
  // because it is an Invalid Date — the month, not the year — which is
  // exactly the near-miss that made the live gap invisible. (T-CORE-S15)
  it.each([
    "2026-02-30",
    "2026-13-01",
    "0000-00-00",
    "0000-01-01",
    "0000-12-31",
    "2023-02-29",
  ])("rejects the impossible date %s", (impossible) => {
    expect(calendarDateString.safeParse(impossible).success).toBe(false);
  });

  // `0001-01-01` is the boundary: Postgres's first AD day, and the first
  // value the year floor lets through. `9999-12-31` is the other end — the
  // four-digit regex caps it there and Postgres accepts it, which is why the
  // floor needs no companion ceiling.
  it.each([
    "0001-01-01",
    "2026-02-28",
    "2024-02-29",
    "2026-08-01",
    "9999-12-31",
  ])("accepts the real date %s", (real) => {
    expect(calendarDateString.parse(real)).toBe(real);
  });

  it("still rejects anything the shape regex rejects", () => {
    expect(calendarDateString.safeParse("2026-8-1").success).toBe(false);
    expect(calendarDateString.safeParse("01/08/2026").success).toBe(false);
    expect(calendarDateString.safeParse("").success).toBe(false);
  });
});

describe("completionResponseSchema", () => {
  const response: CompletionResponse = {
    game: "binairo",
    date: "2026-08-01",
    outcome: "won",
    onTime: true,
    recorded: true,
    elapsedMs: 272_000,
    hintsUsed: 1,
  };

  it("parses and round-trips a valid payload", () => {
    expect(completionResponseSchema.parse(response)).toEqual(response);
  });

  it("parses the idempotent-replay shape (recorded: false, stored values)", () => {
    const replay = { ...response, recorded: false };
    expect(completionResponseSchema.parse(replay)).toEqual(replay);
  });

  it("carries no forbidden daily key at any depth (ADR-0004 leak scan)", () => {
    const keys = collectKeys(completionResponseSchema.parse(response));
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("rejects a payload smuggling the solution it was judged against", () => {
    const smuggled = { ...response, solution: grid };
    expect(completionResponseSchema.safeParse(smuggled).success).toBe(false);
  });

  it("rejects a negative statistic", () => {
    expect(
      completionResponseSchema.safeParse({ ...response, elapsedMs: -1 })
        .success,
    ).toBe(false);
    expect(
      completionResponseSchema.safeParse({ ...response, hintsUsed: -1 })
        .success,
    ).toBe(false);
  });
});

describe("the completion request carries no instant (plan 017 D19)", () => {
  /**
   * `date` is exempt by EXACT match: it is the puzzle's America/Sao_Paulo
   * calendar day, chosen by the server's clock and echoed back — not a
   * moment in time. Everything else that could carry a client-asserted
   * instant is banned, because `completed_at` is the DB clock at insert and
   * the client clock never enters streak arithmetic (CLAUDE.md invariant).
   */
  const INSTANT_SHAPED = /at$|time|clock|instant|epoch|now|date/i;

  it("binairo's key set is exactly the five audited fields", () => {
    expect(Object.keys(binairoCompletionRequestSchema.shape).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
  });

  it("sudoku's key set is exactly the five audited fields", () => {
    expect(Object.keys(sudokuCompletionRequestSchema.shape).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
  });

  it("nonogram's key set is exactly the five audited fields — no `size` (P4)", () => {
    expect(Object.keys(nonogramCompletionRequestSchema.shape).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
  });

  it("no variant of the union declares an instant-shaped key", () => {
    for (const variant of completionRequestSchema.options) {
      for (const key of Object.keys(variant.shape)) {
        if (key === "date") {
          continue;
        }
        expect(INSTANT_SHAPED.test(key)).toBe(false);
      }
    }
  });

  it("a body asserting its own completion instant is rejected, not ignored", () => {
    const asserted = { ...valid, completedAt: "2026-08-01T02:59:59.000Z" };
    expect(completionRequestSchema.safeParse(asserted).success).toBe(false);
  });
});

describe("apiErrorResponseSchema", () => {
  it("parses the minimal envelope and rejects anything larger", () => {
    expect(apiErrorResponseSchema.parse({ error: "no-session" })).toEqual({
      error: "no-session",
    });
    expect(
      apiErrorResponseSchema.safeParse({ error: "no-session", detail: "why" })
        .success,
    ).toBe(false);
    expect(apiErrorResponseSchema.safeParse({}).success).toBe(false);
  });
});
