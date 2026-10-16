import { describe, expect, it } from "vitest";

import {
  apiErrorResponseSchema,
  binairoCompletionRequestSchema,
  calendarDateString,
  completionRequestSchema,
  completionResponseSchema,
  crosswordCompletionRequestSchema,
  dayGameStateSchema,
  HINTS_PER_PUZZLE_CEILING,
  minesweeperCompletionRequestSchema,
  nonogramCompletionRequestSchema,
  queensCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  termoCompletionRequestSchema,
  type BinairoCompletionRequest,
  type CompletionResponse,
  type CrosswordCompletionRequest,
  type MinesweeperCompletionRequest,
  type NonogramCompletionRequest,
  type QueensCompletionRequest,
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

const crosswordGrid: CrosswordCompletionRequest["grid"] = Array.from(
  { length: 25 },
  (_unused, index) => (index % 6 === 0 ? null : "a"),
);

const validCrossword: CrosswordCompletionRequest = {
  game: "crossword",
  date: "2026-09-28",
  grid: crosswordGrid,
  elapsedMs: 272_000,
  hintsUsed: 1,
};

function queensGrid(size: number): QueensCompletionRequest["grid"] {
  return Array.from({ length: size * size }, (_unused, index): 0 | 1 =>
    index % (size + 2) === 0 ? 1 : 0,
  );
}

const validQueens: QueensCompletionRequest = {
  game: "queens",
  date: "2026-10-12",
  grid: queensGrid(9),
  elapsedMs: 272_000,
  hintsUsed: 1,
};

const validMinesweeper: MinesweeperCompletionRequest = {
  game: "minesweeper",
  date: "2026-10-16",
  hit: null,
  elapsedMs: 272_000,
  hintsUsed: 0,
};

describe("hintsUsedSchema", () => {
  const validBodies = [
    valid,
    validCrossword,
    validNonogram,
    validQueens,
    validSudoku,
    validTermo,
  ];

  it("T-CORE-S163: every completion member but Campo Minado, and a completed /day claim, accept 0..HINTS_PER_PUZZLE_CEILING hints and nothing else", () => {
    expect(
      [...validBodies, validMinesweeper].map((body) => body.game).sort(),
    ).toEqual(
      completionRequestSchema.options
        .map((member) => member.shape.game.value)
        .sort(),
    );
    const parsers = [
      ...validBodies.map(
        (body) => (hintsUsed: number) =>
          completionRequestSchema.safeParse({ ...body, hintsUsed }).success,
      ),
      (hintsUsed: number) =>
        dayGameStateSchema.safeParse({ status: "completed", hintsUsed })
          .success,
    ];
    for (const accepts of parsers) {
      for (let hints = 0; hints <= HINTS_PER_PUZZLE_CEILING; hints += 1) {
        expect(accepts(hints), String(hints)).toBe(true);
      }
      for (const bad of [HINTS_PER_PUZZLE_CEILING + 1, -1, 1.5]) {
        expect(accepts(bad), String(bad)).toBe(false);
      }
    }
  });
});

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
      { hintsUsed: HINTS_PER_PUZZLE_CEILING + 1 },
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

describe("crosswordCompletionRequestSchema", () => {
  it("T-CORE-S124: parses and round-trips a row-major 25-cell grid, blocks as null, through the union too", () => {
    expect(crosswordCompletionRequestSchema.parse(validCrossword)).toEqual(
      validCrossword,
    );
    expect(completionRequestSchema.parse(validCrossword)).toEqual(
      validCrossword,
    );
    expect(Object.keys(crosswordCompletionRequestSchema.shape).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
  });

  it("T-CORE-S124: every cell is one a-z letter or null, and a 24- or 26-cell grid fails", () => {
    const withCell = (cell: unknown) => ({
      ...validCrossword,
      grid: [cell, ...crosswordGrid.slice(1)],
    });
    for (const body of [
      withCell("A"),
      withCell("é"),
      withCell("ab"),
      withCell(""),
      withCell(0),
      { ...validCrossword, grid: crosswordGrid.slice(1) },
      { ...validCrossword, grid: [...crosswordGrid, "a"] },
      { ...validCrossword, hintsUsed: HINTS_PER_PUZZLE_CEILING + 1 },
      { ...validCrossword, date: "2026-02-30" },
      { ...validCrossword, clues: [] },
      { ...validSudoku, game: "crossword" },
    ]) {
      expect(
        completionRequestSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
    expect(completionRequestSchema.safeParse(withCell("z")).success).toBe(true);
  });

  it("T-CORE-S190: the grid holds 25 or 49 cells, a 5x5 or a 7x7, and nothing between or past", () => {
    for (const length of [25, 49]) {
      const body = {
        ...validCrossword,
        grid: Array.from({ length }, () => "a"),
      };
      expect(completionRequestSchema.parse(body)).toEqual(body);
    }
    for (const length of [0, 24, 36, 48, 50, 64]) {
      const body = {
        ...validCrossword,
        grid: Array.from({ length }, () => "a"),
      };
      expect(completionRequestSchema.safeParse(body).success, `${length}`).toBe(
        false,
      );
    }
  });
});

describe("queensCompletionRequestSchema", () => {
  it.each([7, 8, 9])(
    "T-CORE-S134: parses and round-trips a %i x %i queens grid, through the union too",
    (size) => {
      const body = { ...validQueens, grid: queensGrid(size) };
      expect(queensCompletionRequestSchema.parse(body)).toEqual(body);
      expect(completionRequestSchema.parse(body)).toEqual(body);
    },
  );

  it("T-CORE-S134: the key set is the five audited fields — no size, no marks", () => {
    expect(Object.keys(queensCompletionRequestSchema.shape).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);
  });

  it("T-CORE-S134: every cell is 0 or 1 — an X mark never reaches the wire — and the length is 49, 64 or 81", () => {
    const withCell = (cell: unknown) => ({
      ...validQueens,
      grid: [cell, ...validQueens.grid.slice(1)],
    });
    for (const body of [
      withCell(null),
      withCell(2),
      withCell("x"),
      withCell(true),
      { ...validQueens, grid: queensGrid(6) },
      { ...validQueens, grid: queensGrid(10) },
      { ...validQueens, grid: validQueens.grid.slice(1) },
      { ...validQueens, hintsUsed: HINTS_PER_PUZZLE_CEILING + 1 },
      { ...validQueens, date: "2026-02-30" },
      { ...validQueens, size: 9 },
      { ...validQueens, marks: [] },
    ]) {
      expect(
        completionRequestSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });
});

describe("minesweeperCompletionRequestSchema", () => {
  it("T-CORE-S199: a won body (hit null) and a lost body (hit a cell) parse and round-trip, through the union too; the key set carries no grid", () => {
    for (const hit of [null, 0, 159]) {
      const body = { ...validMinesweeper, hit };
      expect(minesweeperCompletionRequestSchema.parse(body)).toEqual(body);
      expect(completionRequestSchema.parse(body)).toEqual(body);
    }
    expect(
      Object.keys(minesweeperCompletionRequestSchema.shape).sort(),
    ).toEqual(["date", "elapsedMs", "game", "hintsUsed", "hit"]);
  });

  it("T-CORE-S199: hit is an integer cell in [0, 160) or null, hintsUsed is exactly 0, and nothing else rides along", () => {
    for (const body of [
      { ...validMinesweeper, hit: 160 },
      { ...validMinesweeper, hit: -1 },
      { ...validMinesweeper, hit: 1.5 },
      { ...validMinesweeper, hit: "3" },
      { ...validMinesweeper, hit: undefined },
      { ...validMinesweeper, hintsUsed: 1 },
      { ...validMinesweeper, date: "2026-02-30" },
      { ...validMinesweeper, elapsedMs: -1 },
      { ...validMinesweeper, grid: Array.from({ length: 160 }, () => 0) },
      { ...validMinesweeper, marks: [] },
      { ...valid, game: "minesweeper" },
    ]) {
      expect(
        completionRequestSchema.safeParse(body).success,
        JSON.stringify(body).slice(0, 80),
      ).toBe(false);
    }
  });
});

describe("squareGridSchema array cap", () => {
  const cases = [
    {
      name: "nonogram",
      schema: nonogramCompletionRequestSchema,
      body: validNonogram,
      makeGrid: nonogramGrid,
      largest: 15,
    },
    {
      name: "queens",
      schema: queensCompletionRequestSchema,
      body: validQueens,
      makeGrid: queensGrid,
      largest: 9,
    },
  ];

  it.each(cases)(
    "T-CORE-S192: $name refuses a grid past its largest size with a too_big issue and accepts the largest",
    ({ schema, body, makeGrid, largest }) => {
      const largestBody = { ...body, grid: makeGrid(largest) };
      expect(schema.parse(largestBody)).toEqual(largestBody);

      for (const length of [largest ** 2 + 1, (largest + 1) ** 2]) {
        const result = schema.safeParse({
          ...body,
          grid: Array.from({ length }, () => 0),
        });
        expect(result.success, `${length}`).toBe(false);
        expect(
          result.error?.issues.map((issue) => issue.code),
          `${length}`,
        ).toContain("too_big");
      }
    },
  );
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
