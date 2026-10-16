import { dailySudokuResponseSchema } from "@miolos/core";
import {
  CLASSIC_LAYOUT,
  generateDailySudoku,
  sudokuPeers,
  type SudokuLayout,
} from "@miolos/games/sudoku";
import {
  DIAGONAL_LAYOUT,
  generateSudokuVariant,
} from "@miolos/games/sudoku-variants";
import { describe, expect, it } from "vitest";

import type { UndoAction } from "../src/play/undo";
import { selectionHighlights } from "../src/sudoku/engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const BLANK: readonly number[] = Array.from({ length: 81 }, () => 0);

const FORMAS = generateSudokuVariant({
  seed: 7,
  weekday: 1,
  variant: "irregular",
}).layout;

const DIAGONAL = generateSudokuVariant({
  seed: 7,
  weekday: 1,
  variant: "diagonal",
});

const box = (index: number) =>
  Math.floor(index / 27) * 3 + Math.floor((index % 9) / 3);

function boardOf(givens: readonly number[], layout: SudokuLayout) {
  const daily = dailySudokuResponseSchema.parse({
    game: "sudoku",
    date: "2026-10-16",
    givens,
    tier: 1,
  });
  return play(initSudokuPlayState(daily, layout), {
    type: "restore",
    record: undefined,
    now: 0,
  });
}

function play(
  state: SudokuPlayState,
  ...actions: readonly (SudokuPlayAction | UndoAction)[]
): SudokuPlayState {
  return actions.reduce(sudokuPlayReducer, state);
}

const write = (index: number, digit: SudokuDigit): SudokuPlayAction[] => [
  { type: "select", index },
  { type: "enter-digit", digit, cleanNotes: true },
];

const noteAt = (index: number, digit: SudokuDigit): SudokuPlayAction[] => [
  { type: "select", index },
  { type: "toggle-note", digit },
];

function sameRegionOtherwiseApart(layout: SudokuLayout): [number, number] {
  for (let a = 0; a < 81; a += 1) {
    for (let b = a + 1; b < 81; b += 1) {
      if (
        layout.regions[a] === layout.regions[b] &&
        Math.floor(a / 9) !== Math.floor(b / 9) &&
        a % 9 !== b % 9 &&
        box(a) !== box(b)
      ) {
        return [a, b];
      }
    }
  }
  throw new Error("the Formas fixture has every region inside a box");
}

describe("conflicts and the solved check follow the variant's units (T-WEB-S863)", () => {
  it("flags two 5s on the main diagonal, in different rows, columns and boxes", () => {
    const pair = [...write(0, 5), ...write(40, 5)];

    expect([
      ...play(boardOf(BLANK, DIAGONAL_LAYOUT), ...pair).violating,
    ]).toEqual([0, 40]);
    expect(play(boardOf(BLANK, CLASSIC_LAYOUT), ...pair).violating.size).toBe(
      0,
    );
  });

  it("flags two digits in one Formas region that no row, column or box shares", () => {
    const [a, b] = sameRegionOtherwiseApart(FORMAS);
    const pair = [...write(a, 7), ...write(b, 7)];

    expect([...play(boardOf(BLANK, FORMAS), ...pair).violating]).toEqual([
      a,
      b,
    ]);
    expect(play(boardOf(BLANK, CLASSIC_LAYOUT), ...pair).violating.size).toBe(
      0,
    );
  });

  it("solves a Diagonal board on its own solution", () => {
    const moves = DIAGONAL.givens.flatMap((given, index) =>
      given === 0 ? write(index, DIAGONAL.solution[index] as SudokuDigit) : [],
    );

    expect(
      play(boardOf(DIAGONAL.givens, DIAGONAL.layout), ...moves).status,
    ).toBe("solved");
  });

  it("does not call a classic solution solved on a Diagonal board", () => {
    const classic = generateDailySudoku({ seed: 7, weekday: 1 });
    const moves = classic.givens.flatMap((given, index) =>
      given === 0 ? write(index, classic.solution[index] as SudokuDigit) : [],
    );
    const filled = play(boardOf(classic.givens, DIAGONAL_LAYOUT), ...moves);

    expect(filled.violating.size).toBeGreaterThan(0);
    expect(filled.status).toBe("playing");
  });

  it("keeps the layout through Desfazer and Recomeçar", () => {
    const start = boardOf(BLANK, DIAGONAL_LAYOUT);
    const flagged = play(
      start,
      ...write(0, 5),
      ...write(40, 5),
      ...write(1, 3),
    );

    const undone = play(flagged, { type: "undo" });
    expect(undone.layout).toBe(DIAGONAL_LAYOUT);
    expect([...undone.violating]).toEqual([0, 40]);

    const reset = play(flagged, { type: "reset" });
    expect(reset.layout).toBe(DIAGONAL_LAYOUT);
    expect(
      [...play(reset, ...write(0, 5), ...write(40, 5)).violating].length,
    ).toBe(2);
  });
});

describe("a value clears notes across the variant's units (T-WEB-S864)", () => {
  const FIVE = 1 << 4;

  it("in Diagonal, a 5 at (1,1) takes the 5 note off (9,9), and Desfazer brings it back", () => {
    const noted = play(boardOf(BLANK, DIAGONAL_LAYOUT), ...noteAt(80, 5));
    const written = play(noted, ...write(0, 5));

    expect(written.notes[80]).toBe(0);
    expect(play(written, { type: "undo" }).notes[80]).toBe(FIVE);
  });

  it("Clássico keeps the note at (9,9)", () => {
    const noted = play(boardOf(BLANK, CLASSIC_LAYOUT), ...noteAt(80, 5));

    expect(play(noted, ...write(0, 5)).notes[80]).toBe(FIVE);
  });

  it("a hint cleans the hinted digit off the diagonal too", () => {
    const solution = DIAGONAL.solution as readonly SudokuDigit[];
    const start = boardOf(DIAGONAL.givens, DIAGONAL.layout);
    const hint: SudokuPlayAction = {
      type: "use-hint",
      solution,
      cleanNotes: true,
    };
    const probe = play(start, hint);
    const index = probe.hint.lastIndex ?? -1;
    const digit = solution[index] as SudokuDigit;
    const onlyDiagonal = DIAGONAL_LAYOUT.extraUnits
      .flatMap((unit) => (unit.includes(index) ? unit : []))
      .find(
        (cell) =>
          cell !== index &&
          DIAGONAL.givens[cell] === 0 &&
          !sudokuPeers(index).includes(cell),
      );
    if (onlyDiagonal === undefined) {
      throw new Error("the fixture's first hint is not on a diagonal");
    }

    const noted = play(start, ...noteAt(onlyDiagonal, digit), hint);

    expect(noted.hint.lastIndex).toBe(index);
    expect(noted.notes[onlyDiagonal]).toBe(0);
  });
});

describe("the selection tint follows the variant's units (T-WEB-S865)", () => {
  const tinted = (selected: number, layout: SudokuLayout) =>
    [...selectionHighlights(BLANK, selected, layout).keys()].sort(
      (a, b) => a - b,
    );

  it("in Diagonal, (1,1) tints (9,9)", () => {
    expect(tinted(0, DIAGONAL_LAYOUT)).toContain(80);
    expect(tinted(0, CLASSIC_LAYOUT)).not.toContain(80);
  });

  it("in Formas, the tint covers the region, not the box", () => {
    const [a] = sameRegionOtherwiseApart(FORMAS);
    const expected = Array.from({ length: 81 }, (_, index) => index).filter(
      (index) =>
        Math.floor(index / 9) === Math.floor(a / 9) ||
        index % 9 === a % 9 ||
        FORMAS.regions[index] === FORMAS.regions[a],
    );

    expect(tinted(a, FORMAS)).toEqual(expected);
  });
});
