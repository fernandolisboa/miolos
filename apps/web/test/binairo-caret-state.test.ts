import { type DailyBinairoResponse } from "@miolos/core";
import { generateBinairo, solveBinairo } from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import {
  binairoMistakes,
  initPlayState,
  playReducer,
  type PlayAction,
  type PlayState,
} from "../src/binairo/state";
import { withMistakes } from "../src/play/mistakes";
import type { UndoAction } from "../src/play/undo";

const PUZZLE = generateBinairo({ seed: 20_261_022, weekday: 2 });
const DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: "2026-10-22",
  size: 8,
  givens: [...PUZZLE.givens],
};
const SOLUTION = solveBinairo(PUZZLE.givens) ?? PUZZLE.solution;
const OPEN = PUZZLE.givens.flatMap((given, index) =>
  given === null ? [index] : [],
);
const GIVEN = PUZZLE.givens.findIndex((given) => given !== null);
const [A = 0, B = 0] = OPEN;
const FIRST = 1;

const select = (index: number): PlayAction => ({ type: "select", index });
const enter = (value: 0 | 1): PlayAction => ({ type: "enter-value", value });
const CLEAR: PlayAction = { type: "clear-cell" };
const UNDO: UndoAction = { type: "undo" };
const REDO: UndoAction = { type: "redo" };

function run(
  state: PlayState,
  ...actions: readonly (PlayAction | UndoAction)[]
): PlayState {
  return actions.reduce(playReducer, state);
}

const fresh = () => initPlayState(DAILY);

const judged = withMistakes<PlayState, PlayAction | UndoAction>(
  playReducer,
  binairoMistakes(SOLUTION, PUZZLE.givens),
  true,
);

function limited(
  state: PlayState,
  ...actions: readonly (PlayAction | UndoAction)[]
): PlayState {
  return actions.reduce(judged, state);
}

const right = (index: number): 0 | 1 => SOLUTION[index] ?? 0;
const wrong = (index: number): 0 | 1 => (right(index) === 1 ? 0 : 1);

describe("the Binairo caret is state: select, move, enter, clear (T-WEB-S990)", () => {
  it("starts with nothing selected", () => {
    expect(fresh().selected).toBeNull();
  });

  it("selects any cell, a given included, and returns the same state for the cell already selected", () => {
    const onGiven = run(fresh(), select(GIVEN));
    expect(onGiven.selected).toBe(GIVEN);
    expect(run(onGiven, select(GIVEN))).toBe(onGiven);
  });

  it("refuses an index outside the board", () => {
    const state = fresh();
    expect(run(state, select(-1))).toBe(state);
    expect(run(state, select(64))).toBe(state);
    expect(run(state, select(1.5))).toBe(state);
  });

  it("moves from cell 0 when nothing is selected, clamps at every edge, and keeps the same state at an edge", () => {
    expect(
      run(fresh(), { type: "move-selection", rows: 0, columns: 1 }).selected,
    ).toBe(0);
    const corner = run(fresh(), select(0));
    expect(run(corner, { type: "move-selection", rows: -1, columns: -1 })).toBe(
      corner,
    );
    expect(
      run(corner, { type: "move-selection", rows: 1, columns: 1 }).selected,
    ).toBe(9);
    expect(
      run(corner, { type: "move-selection", rows: 7, columns: 7 }).selected,
    ).toBe(63);
    expect(
      run(corner, { type: "move-selection", rows: 99, columns: 99 }).selected,
    ).toBe(63);
  });

  it("writes the digit at the caret, and the same digit again clears it", () => {
    const written = run(fresh(), select(A), enter(1));
    expect(written.entries[A]).toBe(1);
    expect(run(written, enter(1)).entries[A]).toBeNull();
    expect(run(written, enter(0)).entries[A]).toBe(0);
    expect(run(written, CLEAR).entries[A]).toBeNull();
  });

  it("refuses a given, and with nothing selected, returning the very same state", () => {
    const nothing = fresh();
    expect(run(nothing, enter(1))).toBe(nothing);
    expect(run(nothing, CLEAR)).toBe(nothing);
    const onGiven = run(fresh(), select(GIVEN));
    expect(run(onGiven, enter(1))).toBe(onGiven);
    expect(run(onGiven, CLEAR)).toBe(onGiven);
  });

  it("ignores the brush: a digit key writes its own digit in paint mode", () => {
    const painting = run(fresh(), { type: "set-mode", value: 0 }, select(A));
    expect(run(painting, enter(1)).entries[A]).toBe(1);
  });

  it("clears the hint spotlight on a select but not when a refused write changes nothing", () => {
    const hinted = run(fresh(), { type: "use-hint", solution: SOLUTION });
    expect(hinted.hint.spotlight.length).toBeGreaterThan(0);
    expect(run(hinted, select(A)).hint.spotlight).toEqual([]);
    const onGiven = run(hinted, select(GIVEN));
    expect(onGiven.hint.spotlight).toEqual([]);
    const lit = { ...hinted, selected: GIVEN };
    expect(run(lit, enter(1))).toBe(lit);
    expect(run(lit, CLEAR)).toBe(lit);
  });
});

describe("undo restores the caret and a select is never a step (T-WEB-S991)", () => {
  it("adds no undo step for a select or a move", () => {
    const moved = run(
      fresh(),
      select(A),
      { type: "move-selection", rows: 1, columns: 0 },
      select(B),
    );
    expect(moved.history.steps).toHaveLength(0);
  });

  it("takes a typed digit back to the cell and the caret it was written from", () => {
    const typed = run(fresh(), select(A), enter(1), select(B), enter(1));
    expect(typed.history.steps).toHaveLength(2);
    const back = run(typed, UNDO);
    expect(back.entries[B]).toBeNull();
    expect(back.selected).toBe(B);
    const further = run(back, UNDO);
    expect(further.entries[A]).toBeNull();
    expect(further.selected).toBe(A);
    const forward = run(further, REDO, REDO);
    expect(forward.entries[B]).toBe(1);
    expect(forward.selected).toBe(B);
  });

  it("restores the caret a tap was made from", () => {
    const tapped = run(fresh(), select(B), {
      type: "tap",
      index: A,
      press: "tap",
      first: FIRST,
    });
    expect(tapped.selected).toBe(B);
    const focused = run(tapped, select(A));
    expect(run(focused, UNDO).selected).toBe(B);
  });

  it("keeps selected out of the step fields, so a select between two writes does not split them", () => {
    const state = run(fresh(), select(A), enter(1));
    expect(state.history.steps).toHaveLength(1);
    expect(run(state, select(B)).history).toBe(state.history);
  });
});

describe("a typed wrong value counts once, a held cycle tap is judged once (T-WEB-S992)", () => {
  const begin = () =>
    limited(fresh(), { type: "restore", record: undefined, now: 0 });

  it("counts a typed wrong digit once", () => {
    const typed = limited(begin(), select(A), enter(wrong(A)));
    expect(typed.mistakes.cells).toEqual([A]);
    expect(typed.mistakes.held).toBeNull();
    expect(limited(typed, select(B), enter(right(B))).mistakes.cells).toEqual([
      A,
    ]);
  });

  it("counts nothing for a right digit, a clear, or a select", () => {
    const state = limited(begin(), select(A), enter(right(A)), CLEAR);
    expect(state.mistakes.cells).toEqual([]);
  });

  it("judges a held cycle tap and a key on the same cell once", () => {
    const held = limited(begin(), {
      type: "tap",
      index: A,
      press: "tap",
      first: wrong(A),
    });
    expect(held.mistakes.held).toMatchObject({ index: A });
    const keyed = limited(held, select(A), enter(wrong(A)));
    expect(keyed.mistakes.cells).toEqual([]);
    expect(keyed.mistakes.held).toBeNull();
  });

  it("keeps a held tap while the caret moves, and judges it at the next write elsewhere", () => {
    const held = limited(begin(), {
      type: "tap",
      index: A,
      press: "tap",
      first: wrong(A),
    });
    const moved = limited(held, select(B), {
      type: "move-selection",
      rows: 1,
      columns: 0,
    });
    expect(moved.mistakes).toBe(held.mistakes);
    expect(limited(moved, select(B), enter(right(B))).mistakes.cells).toEqual([
      A,
    ]);
  });

  it("blocks every write, a key included, once three are counted", () => {
    const [C = 0, D = 0, E = 0] = OPEN.slice(2);
    const frozen = limited(
      begin(),
      select(A),
      enter(wrong(A)),
      select(C),
      enter(wrong(C)),
      select(D),
      enter(wrong(D)),
    );
    expect(frozen.mistakes.cells).toHaveLength(3);
    const after = limited(frozen, select(E), enter(right(E)));
    expect(after.entries[E]).toBeNull();
    expect(after.selected).toBe(E);
  });
});
