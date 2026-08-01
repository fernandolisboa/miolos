import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  binairoCompletionRequestSchema,
  calendarDateString,
  completionRequestSchema,
  completionResponseSchema,
  sudokuCompletionRequestSchema,
  type BinairoCompletionRequest,
  type CompletionResponse,
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

  // Rewritten from `game: "sudoku"` at #23 (plan 018 T-CORE-S6): with sudoku
  // in the union that body would still be rejected, but for the wrong reason
  // — a 64-cell 0/1 grid is not a valid sudoku — i.e. a test proving nothing.
  // `nonogram` is the game the union genuinely does not carry.
  it("rejects a game the union does not carry yet (#25/#27 widen it)", () => {
    expect(
      completionRequestSchema.safeParse({ ...valid, game: "nonogram" }).success,
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
  // The shape regex alone passes all three of these straight into an
  // `eq(dailyPuzzles.date, date)` against a Postgres `date` column, where
  // they raise 22008 — a 500 from a two-character body edit.
  it.each(["2026-02-30", "2026-13-01", "0000-00-00", "2023-02-29"])(
    "rejects the impossible date %s",
    (impossible) => {
      expect(calendarDateString.safeParse(impossible).success).toBe(false);
    },
  );

  it.each(["2026-02-28", "2024-02-29", "2026-08-01"])(
    "accepts the real date %s",
    (real) => {
      expect(calendarDateString.parse(real)).toBe(real);
    },
  );

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
