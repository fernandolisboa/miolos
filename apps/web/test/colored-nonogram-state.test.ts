import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { describe, expect, it } from "vitest";

import {
  coloredNonogramReducer,
  initColoredNonogramState,
  type ColoredNonogramAction,
  type ColoredNonogramState,
} from "../src/colored-nonogram/state";
import type { UndoAction } from "../src/play/undo";

const PUZZLE = generateColoredNonogram(20_260_801, 10);

function fresh(): ColoredNonogramState {
  return initColoredNonogramState({
    date: "1970-01-01",
    clues: PUZZLE.clues,
    solution: PUZZLE.solution,
  });
}

function play(
  state: ColoredNonogramState,
  ...actions: readonly (ColoredNonogramAction | UndoAction)[]
): ColoredNonogramState {
  return actions.reduce(coloredNonogramReducer, state);
}

describe("the coloured Nonogram reducer: brush, presses, strokes, completion and undo (T-WEB-S870)", () => {
  it("has at least two tones to tell apart", () => {
    expect(PUZZLE.clues.palette.length).toBeGreaterThanOrEqual(2);
  });

  it("starts on the first tone; picking a tone fills with it, and ✕ keeps the tone for the right button", () => {
    const start = fresh();
    expect([start.brush, start.tone]).toEqual(["fill", 1]);

    const toned = play(start, { type: "set-tone", tone: 2 });
    expect([toned.brush, toned.tone]).toEqual(["fill", 2]);

    const crossing = play(toned, { type: "set-brush", brush: "cross" });
    expect([crossing.brush, crossing.tone]).toEqual(["cross", 2]);
    expect(play(crossing, { type: "set-tone", tone: 2 }).brush).toBe("fill");
  });

  it("a tap writes the tone, again clears, and another tone repaints; the right button writes the other of ✕ and the tone", () => {
    const toned = play(fresh(), { type: "set-tone", tone: 2 });
    const tap = (
      state: ColoredNonogramState,
      press: "tap" | "left" | "right",
    ) => play(state, { type: "mark-cell", index: 0, press });

    expect(tap(toned, "tap").entries[0]).toBe(2);
    expect(tap(tap(toned, "tap"), "tap").entries[0]).toBeNull();
    expect(tap(toned, "right").entries[0]).toBe(0);
    expect(
      tap(play(tap(toned, "left"), { type: "set-tone", tone: 1 }), "left")
        .entries[0],
    ).toBe(1);

    const crossing = play(toned, { type: "set-brush", brush: "cross" });
    expect(tap(crossing, "left").entries[0]).toBe(0);
    expect(tap(crossing, "right").entries[0]).toBe(2);
  });

  it("the keyboard's 1 paints the current tone and 2 crosses", () => {
    const toned = play(
      fresh(),
      { type: "set-tone", tone: 2 },
      {
        type: "select",
        index: 3,
      },
    );
    expect(play(toned, { type: "enter-value", value: 1 }).entries[3]).toBe(2);
    expect(play(toned, { type: "enter-value", value: 0 }).entries[3]).toBe(0);
  });

  it("a stroke paints one tone over anything, and a stroke from its own tone clears only that tone", () => {
    const seeded = play(
      fresh(),
      { type: "mark-cell", index: 1, press: "tap" },
      { type: "set-tone", tone: 2 },
      { type: "mark-cell", index: 0, press: "tap" },
    );
    expect(seeded.entries.slice(0, 3)).toEqual([2, 1, null]);

    const painted = play(
      seeded,
      { type: "stroke-start", index: 2, press: "tap" },
      { type: "paint-over", index: 1 },
      { type: "paint-over", index: 0 },
    );
    expect(painted.entries.slice(0, 3)).toEqual([2, 2, 2]);

    const cleared = play(
      seeded,
      { type: "stroke-start", index: 0, press: "tap" },
      { type: "paint-over", index: 1 },
      { type: "paint-over", index: 2 },
    );
    expect(cleared.entries.slice(0, 3)).toEqual([null, 1, null]);
  });

  it("solves only when every painted cell holds its own tone; crosses never count", () => {
    const paintAll = (toneOf: (mark: number) => number) =>
      PUZZLE.solution.reduce<ColoredNonogramState>(
        (state, mark, index) =>
          mark === 0
            ? play(state, { type: "mark-cell", index, press: "right" })
            : play(
                state,
                { type: "set-tone", tone: toneOf(mark) },
                { type: "mark-cell", index, press: "tap" },
              ),
        fresh(),
      );

    expect(paintAll(() => 1).status).toBe("playing");
    const solved = paintAll((mark) => mark);
    expect(solved.status).toBe("solved");
    expect(solved.entries).toContain(0);

    const tonesOnly = PUZZLE.solution.reduce<ColoredNonogramState>(
      (state, mark, index) =>
        mark === 0
          ? state
          : play(
              state,
              { type: "set-tone", tone: mark },
              { type: "mark-cell", index, press: "tap" },
            ),
      fresh(),
    );
    expect(tonesOnly.entries).not.toContain(0);
    expect(tonesOnly.status).toBe("solved");
  });

  it("a whole drag is one undo step, and the tone and brush survive the undo", () => {
    const dragged = play(
      fresh(),
      { type: "set-tone", tone: 2 },
      { type: "stroke-start", index: 0, press: "tap" },
      { type: "paint-over", index: 1 },
      { type: "paint-over", index: 2 },
    );
    expect(dragged.entries.slice(0, 3)).toEqual([2, 2, 2]);

    const undone = play(dragged, { type: "undo" });
    expect(undone.entries.every((entry) => entry === null)).toBe(true);
    expect([undone.brush, undone.tone]).toEqual(["fill", 2]);
  });

  it("restore only hydrates: no record shape reaches the coloured board", () => {
    const restored = play(fresh(), {
      type: "restore",
      record: undefined,
      now: 42,
    });
    expect([restored.hydrated, restored.now]).toEqual([true, 42]);
    expect(restored.entries).toEqual(fresh().entries);
  });
});
