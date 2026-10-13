import {
  dailyCrosswordResponseSchema,
  dailyNonogramResponseSchema,
  dailyQueensResponseSchema,
  dailySudokuResponseSchema,
  type DailyBinairoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { initPlayState, playReducer } from "../src/binairo/state";
import {
  crosswordPlayReducer,
  initCrosswordPlayState,
} from "../src/crossword/state";
import { idleHint, spentHint, unlit } from "../src/play/hint-state";
import type { HintState } from "../src/play/types";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
} from "../src/nonogram/state";
import { initQueensPlayState, queensPlayReducer } from "../src/queens/state";
import { initSudokuPlayState, sudokuPlayReducer } from "../src/sudoku/state";

const DATE = "2026-10-13";
const SEED = 20_261_013;

describe("idleHint, unlit and spentHint (T-WEB-S562)", () => {
  it("idleHint keeps the count and clears the cell, the reason and the spotlight", () => {
    expect(idleHint(2)).toEqual({
      used: 2,
      lastIndex: null,
      reason: null,
      spotlight: [],
    });
  });

  it("unlit clears only the spotlight, and returns the same object when there is none", () => {
    const lit = {
      hint: { used: 1, lastIndex: 4, reason: "why", spotlight: [1, 2] },
      other: true,
    };
    expect(unlit(lit)).toEqual({
      hint: { used: 1, lastIndex: 4, reason: "why", spotlight: [] },
      other: true,
    });
    const dark = { hint: idleHint(1) };
    expect(unlit(dark)).toBe(dark);
  });

  it("spentHint adds one to the count and records the cell, the reason and the spotlight", () => {
    const hint: HintState<string> = idleHint(1);
    expect(spentHint(hint, { index: 7, reason: "why" })).toEqual({
      used: 2,
      lastIndex: 7,
      reason: "why",
      spotlight: [],
    });
    expect(
      spentHint(hint, { index: 7, reason: "why", spotlight: [3, 4] }).spotlight,
    ).toEqual([3, 4]);
  });
});

interface ResetCase {
  readonly name: string;
  readonly reset: () => HintState<unknown>;
}

const LIT = {
  used: 1,
  lastIndex: 0,
  reason: { kind: "fill" },
  spotlight: [1],
} as const;

function resetCase<
  S extends { readonly entries: readonly unknown[]; readonly hint: unknown },
>(
  name: string,
  fresh: S,
  decided: unknown,
  reduce: (state: S, action: { readonly type: "reset" }) => S,
): ResetCase {
  return {
    name,
    reset: () => {
      const lit = {
        ...fresh,
        entries: fresh.entries.map((entry, index) =>
          index === 0 ? decided : entry,
        ),
        hint: LIT,
      };
      return reduce(lit, { type: "reset" }).hint as HintState<unknown>;
    },
  };
}

const SUDOKU = generateDailySudoku({ seed: SEED, weekday: 1 });
const SUDOKU_FRESH = initSudokuPlayState(
  dailySudokuResponseSchema.parse({
    game: "sudoku",
    date: DATE,
    givens: SUDOKU.givens,
    tier: SUDOKU.tier,
  }),
);

const BINAIRO = generateBinairo({ seed: SEED, weekday: 2 });
const BINAIRO_DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO.givens],
};

const NONOGRAM = generateNonogram(SEED, 1);
const QUEENS = generateQueens({ seed: SEED, weekday: 1 });

const CROSSWORD_FRESH = initCrosswordPlayState(
  dailyCrosswordResponseSchema.parse({
    game: "crossword",
    date: DATE,
    grid: [
      ["c", "a", "t", null, null],
      ["a", null, "o", null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    clues: [
      { number: 1, direction: "across", row: 0, col: 0, length: 3, clue: "a" },
      { number: 1, direction: "down", row: 0, col: 0, length: 2, clue: "b" },
    ],
  }),
);

describe("Recomeçar forgets the reason and the spotlight in every reducer (T-WEB-S562)", () => {
  const cases = [
    resetCase("sudoku", SUDOKU_FRESH, 1, sudokuPlayReducer),
    resetCase("binairo", initPlayState(BINAIRO_DAILY), 1, playReducer),
    resetCase(
      "nonogram",
      initNonogramPlayState(
        dailyNonogramResponseSchema.parse({
          game: "nonogram",
          date: DATE,
          size: NONOGRAM.size,
          clues: NONOGRAM.clues,
        }),
      ),
      1,
      nonogramPlayReducer,
    ),
    resetCase(
      "queens",
      initQueensPlayState(
        dailyQueensResponseSchema.parse({
          game: "queens",
          date: DATE,
          size: QUEENS.size,
          regions: QUEENS.regions,
        }),
      ),
      1,
      queensPlayReducer,
    ),
    resetCase("crossword", CROSSWORD_FRESH, "x", crosswordPlayReducer),
  ];

  it.each(cases)(
    "$name keeps the count and clears the cell, the reason and the spotlight",
    ({ reset }) => {
      expect(reset()).toEqual(idleHint(1));
    },
  );
});

describe("the next board action puts the spotlight out (T-WEB-S562)", () => {
  const nonogram = initNonogramPlayState(
    dailyNonogramResponseSchema.parse({
      game: "nonogram",
      date: DATE,
      size: NONOGRAM.size,
      clues: NONOGRAM.clues,
    }),
  );
  const lit = { ...nonogram, selected: 0, hint: { ...LIT, used: 1 } };

  it("clears it on a new selection, a move and a written cell, but not on re-selecting", () => {
    expect(nonogramPlayReducer(lit, { type: "select", index: 0 })).toBe(lit);
    for (const action of [
      { type: "select", index: 1 },
      { type: "move-selection", rows: 0, columns: 1 },
      { type: "enter-value", value: 1 },
      { type: "mark-cell", index: 1, press: "tap" },
    ] as const) {
      expect(nonogramPlayReducer(lit, action).hint.spotlight).toEqual([]);
    }
  });

  it("clears it on a Binairo tap", () => {
    const binairo = initPlayState(BINAIRO_DAILY);
    const index = BINAIRO.givens.findIndex((given) => given === null);
    const tapped = playReducer(
      { ...binairo, hint: LIT },
      { type: "tap", index, press: "tap" },
    );
    expect(tapped.hint.spotlight).toEqual([]);
  });
});
