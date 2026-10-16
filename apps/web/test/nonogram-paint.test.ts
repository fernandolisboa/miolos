import { dailyNonogramResponseSchema } from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
import { describe, expect, it } from "vitest";

import type { Press } from "../src/play/brush";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramBrush,
  type NonogramCellValue,
  type NonogramPlayState,
} from "../src/nonogram/state";

const PUZZLE = generateNonogram(20_260_801, 1);

function startingAt(
  brush: NonogramBrush,
  start: NonogramCellValue,
  stroke: NonogramPlayState["stroke"] = null,
): NonogramPlayState {
  const state = initNonogramPlayState(
    dailyNonogramResponseSchema.parse({
      game: "nonogram",
      date: "2026-08-01",
      size: PUZZLE.size,
      clues: PUZZLE.clues,
    }),
  );
  return {
    ...state,
    brush,
    stroke,
    entries: state.entries.map((entry, at) => (at === 0 ? start : entry)),
  };
}

type Start = NonogramCellValue;

const PRESSES: readonly (readonly [NonogramBrush, Press, 0 | 1])[] = [
  ["fill", "tap", 1],
  ["fill", "left", 1],
  ["fill", "right", 0],
  ["cross", "tap", 0],
  ["cross", "left", 0],
  ["cross", "right", 1],
];

const STARTS: readonly Start[] = [null, 0, 1];

describe("the Clássico Nonogram paints exactly as before the coloured variant shared its brush (T-WEB-S871)", () => {
  it.each(
    PRESSES.flatMap(([brush, press, mark]) =>
      STARTS.map((start) => [brush, press, start, mark] as const),
    ),
  )(
    "%s brush, %s press on a %s cell: a tap toggles and a stroke opens on the pressed mark",
    (brush, press, start, mark) => {
      const tapped = nonogramPlayReducer(startingAt(brush, start), {
        type: "mark-cell",
        index: 0,
        press,
      });
      expect(tapped.entries[0]).toBe(start === mark ? null : mark);
      expect(tapped.stroke).toBeNull();

      const stroked = nonogramPlayReducer(startingAt(brush, start), {
        type: "stroke-start",
        index: 0,
        press,
      });
      expect(stroked.entries[0]).toBe(start === mark ? null : mark);
      expect(stroked.stroke).toStrictEqual({
        value: mark,
        clears: start === mark,
      });
    },
  );

  it.each(
    ([0, 1] as const).flatMap((value) =>
      [false, true].flatMap((clears) =>
        STARTS.map((start) => [value, clears, start] as const),
      ),
    ),
  )(
    "a stroke of %i (clears: %s) passing over a %s cell",
    (value, clears, start) => {
      const over = nonogramPlayReducer(
        startingAt("fill", start, { value, clears }),
        { type: "paint-over", index: 0 },
      );
      const expected = clears ? (start === value ? null : start) : value;
      expect(over.entries[0]).toBe(expected);
      expect(over.stroke).toStrictEqual({ value, clears });
    },
  );

  it("a stroke that starts off the board drops the stroke, and a paint-over without one writes nothing", () => {
    expect(
      nonogramPlayReducer(
        startingAt("fill", null, { value: 1, clears: false }),
        {
          type: "stroke-start",
          index: 999,
          press: "tap",
        },
      ).stroke,
    ).toBeNull();
    const idle = startingAt("fill", null);
    expect(nonogramPlayReducer(idle, { type: "paint-over", index: 0 })).toBe(
      idle,
    );
  });
});
