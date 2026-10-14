import { describe, expect, it } from "vitest";

import {
  cycled,
  painted,
  pressedMark,
  strokeEffect,
  toggled,
  type Press,
} from "../src/play/brush";

describe("the mark a press writes (T-WEB-S492)", () => {
  const CASES: readonly (readonly [0 | 1, Press, 0 | 1])[] = [
    [1, "tap", 1],
    [1, "left", 1],
    [1, "right", 0],
    [0, "tap", 0],
    [0, "left", 0],
    [0, "right", 1],
  ];

  it.each(CASES)("brush %i with a %s press writes %i", (brush, press, mark) => {
    expect(pressedMark(brush, press)).toBe(mark);
  });

  it("toggles a cell: the same mark clears, anything else writes", () => {
    expect(toggled(null, 1)).toBe(1);
    expect(toggled(1, 1)).toBeNull();
    expect(toggled(0, 1)).toBe(1);
    expect(toggled(null, 0)).toBe(0);
    expect(toggled(0, 0)).toBeNull();
    expect(toggled(1, 0)).toBe(0);
  });

  it("cycles empty, the first value, the other, empty", () => {
    expect(cycled(null, 1)).toBe(1);
    expect(cycled(1, 1)).toBe(0);
    expect(cycled(0, 1)).toBeNull();

    expect(cycled(null, 0)).toBe(0);
    expect(cycled(0, 0)).toBe(1);
    expect(cycled(1, 0)).toBeNull();
  });
});

describe("a stroke's first cell decides (T-WEB-S493)", () => {
  it("clears when the first cell already holds the mark, and writes otherwise", () => {
    expect(strokeEffect(1, 1)).toStrictEqual({ value: 1, clears: true });
    expect(strokeEffect(null, 1)).toStrictEqual({ value: 1, clears: false });
    expect(strokeEffect(0, 1)).toStrictEqual({ value: 1, clears: false });
  });

  it("a writing stroke sets every cell it enters, over any mark", () => {
    const effect = strokeEffect(null, 1);
    expect(painted(effect, null)).toBe(1);
    expect(painted(effect, 0)).toBe(1);
    expect(painted(effect, 1)).toBe(1);
  });

  it("a clearing stroke clears only the cells holding the mark", () => {
    const effect = strokeEffect(1, 1);
    expect(painted(effect, 1)).toBeNull();
    expect(painted(effect, 0)).toBe(0);
    expect(painted(effect, null)).toBeNull();
  });

  it("is idempotent on re-entry", () => {
    for (const start of [null, 0, 1] as const) {
      const effect = strokeEffect(start, 1);
      for (const current of [null, 0, 1] as const) {
        const once = painted(effect, current);
        expect(painted(effect, once)).toBe(once);
      }
    }
  });
});
