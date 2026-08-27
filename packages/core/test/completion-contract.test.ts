import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  binairoCompletionRequestSchema,
  calendarDateString,
  completionRequestSchema,
  completionResponseSchema,
  nonogramCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  termoCompletionRequestSchema,
  type BinairoCompletionRequest,
  type CompletionResponse,
  type NonogramCompletionRequest,
  type SudokuCompletionRequest,
  type TermoCompletionRequest,
} from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

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

const NONOGRAM_SIZES = [5, 8, 10, 15] as const;

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

const validTermo: TermoCompletionRequest = {
  game: "termo",
  date: "2026-08-01",
  guesses: ["praga", "sinal", "corte"],
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
    const body: unknown = JSON.parse(
      `{"__proto__":{"polluted":true},${JSON.stringify(valid).slice(1)}`,
    );

    expect(Object.prototype.hasOwnProperty.call(body, "__proto__")).toBe(true);

    const parsed = binairoCompletionRequestSchema.safeParse(body);

    expect(parsed.success).toBe(true);

    expect(Object.keys(parsed.success ? parsed.data : {}).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
    expect("polluted" in Object.prototype).toBe(false);

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

  it("T-CORE-S23: the union now carries termo, and a relabelled binairo body still fails", () => {
    expect(completionRequestSchema.safeParse(validTermo).success).toBe(true);
    expect(
      completionRequestSchema.safeParse({ ...valid, game: "termo" }).success,
    ).toBe(false);
    expect(
      completionRequestSchema.safeParse({ ...validTermo, game: "xadrez" })
        .success,
    ).toBe(false);
  });
});

describe("termoCompletionRequestSchema", () => {
  it("T-CORE-S22: parses and round-trips a six-guess submission, through the union too", () => {
    expect(termoCompletionRequestSchema.parse(validTermo)).toEqual(validTermo);
    const six = {
      ...validTermo,
      guesses: Array.from({ length: 6 }, () => "praga"),
    };
    expect(completionRequestSchema.parse(six)).toEqual(six);
  });

  it("T-CORE-S22: `guesses` is bounded 1..6 — the board's own bound, on the wire", () => {
    for (const length of [1, 6]) {
      expect(
        termoCompletionRequestSchema.safeParse({
          ...validTermo,
          guesses: Array.from({ length }, () => "praga"),
        }).success,
        `${String(length)} guesses must parse`,
      ).toBe(true);
    }
    for (const length of [0, 7]) {
      expect(
        termoCompletionRequestSchema.safeParse({
          ...validTermo,
          guesses: Array.from({ length }, () => "praga"),
        }).success,
        `${String(length)} guesses must fail`,
      ).toBe(false);
    }
  });

  it("T-CORE-S22: every guess is NORMALIZED — accents and case never reach the judge", () => {
    for (const guess of ["CAFÉ", "café", "cafe", "cafés", "pra ga", ""]) {
      expect(
        termoCompletionRequestSchema.safeParse({
          ...validTermo,
          guesses: [guess],
        }).success,
        `${guess} must fail`,
      ).toBe(false);
    }
  });

  it("T-CORE-S22: carries NO tiles, NO outcome, NO answer and no other smuggled key", () => {
    for (const extra of [
      { tiles: [["correct", "correct", "correct", "correct", "correct"]] },
      { outcome: "won" },
      { answer: "praga" },
    ]) {
      expect(
        termoCompletionRequestSchema.safeParse({ ...validTermo, ...extra })
          .success,
      ).toBe(false);
    }
  });

  it("T-CORE-S22: `elapsedMs`/`hintsUsed` carry binairo's bounds UNCHANGED", () => {
    expect(
      termoCompletionRequestSchema.safeParse({
        ...validTermo,
        elapsedMs: 86_400_000,
        hintsUsed: 1,
      }).success,
    ).toBe(true);
    for (const bad of [
      { elapsedMs: -1 },
      { elapsedMs: 86_400_001 },
      { elapsedMs: 1.5 },
      { hintsUsed: 2 },
      { hintsUsed: -1 },
    ]) {
      expect(
        termoCompletionRequestSchema.safeParse({ ...validTermo, ...bad })
          .success,
      ).toBe(false);
    }
  });

  it("T-CORE-S22: `date` is calendarDateString — an impossible day and year 0 both fail", () => {
    for (const date of ["2026-02-30", "0000-01-01"]) {
      expect(
        termoCompletionRequestSchema.safeParse({ ...validTermo, date }).success,
        `${date} must fail`,
      ).toBe(false);
    }
  });
});

describe("nonogramCompletionRequestSchema", () => {
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

  it("T-CORE-S22: termo's key set is exactly the five audited fields — `guesses` where the grids carry `grid`", () => {
    expect(Object.keys(termoCompletionRequestSchema.shape).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "guesses",
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
