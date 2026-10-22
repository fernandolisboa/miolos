import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FC_SEED } from "../daily-arbitraries";
import { layMines, startMinesweeper } from "../../src/minesweeper/index";
import { solveMinesweeper } from "../../src/minesweeper/solve";
import type {
  MinesweeperField,
  MinesweeperState,
} from "../../src/minesweeper/index";
import { fieldFrom, neighboursOf } from "./fixtures";

function singleRuleMoves(state: MinesweeperState): number {
  const field = state.field!;
  return field.counts.filter((count, cell) => {
    const hidden = neighboursOf(field.rows, field.columns, cell).filter(
      (n) => !state.open[n],
    );
    return (
      state.open[cell] &&
      hidden.length > 0 &&
      (count === 0 || count === hidden.length)
    );
  }).length;
}

function expectSound(field: MinesweeperField, state: MinesweeperState): void {
  expect(state.status).not.toBe("lost");
  state.open.forEach((open, cell) => {
    if (open) {
      expect(field.mines[cell]).toBe(false);
    }
    if (state.marks[cell] === "flag") {
      expect(field.mines[cell]).toBe(true);
    }
  });
}

describe("solveMinesweeper", () => {
  it("leaves a corner 50/50 unsolved, flagging and opening nothing there", () => {
    const field = fieldFrom(4, 2, [0]);

    const state = solveMinesweeper(field, 7);

    expect(state.status).toBe("playing");
    expect(state.open.slice(0, 2)).toEqual([false, false]);
    expect(state.marks.slice(0, 2)).toEqual([null, null]);
  });

  it("solves two mines in the top corner of a 4×3 field by the single-number rule", () => {
    const field = fieldFrom(4, 3, [0, 1]);
    expect(singleRuleMoves(startMinesweeper(field, 10))).toBeGreaterThan(0);

    const state = solveMinesweeper(field, 10);

    expect(state.status).toBe("won");
    expect(state.open[2]).toBe(true);
  });

  it("solves a 1-2-1 against the walls, which no single number can start", () => {
    const field = fieldFrom(4, 3, [0, 2]);
    expect(singleRuleMoves(startMinesweeper(field, 10))).toBe(0);

    const state = solveMinesweeper(field, 10);

    expect(state.status).toBe("won");
    expect(state.open[1]).toBe(true);
  });

  it("solves a 4×6 field with mines at 6, 9 and 17, which stalls without a subset step between numbers two cells apart", () => {
    const state = solveMinesweeper(fieldFrom(4, 6, [6, 9, 17]), 19);

    expect(state.status).toBe("won");
  });

  // ADR-0055: CI gate 2232 ms × 4 → 10_000.
  it("is sound: every cell it opens is safe and every cell it flags is a mine", () => {
    const fieldArb = fc
      .record({
        rows: fc.integer({ min: 4, max: 16 }),
        columns: fc.integer({ min: 4, max: 16 }),
        seed: fc.integer({ min: 0, max: 0xffffffff }),
        density: fc.integer({ min: 5, max: 30 }),
        clearStart: fc.boolean(),
      })
      .chain((options) =>
        fc.record({
          options: fc.constant(options),
          start: fc.nat(options.rows * options.columns - 1),
        }),
      );
    fc.assert(
      fc.property(fieldArb, ({ options, start }) => {
        const { rows, columns, seed, density, clearStart } = options;
        const field = layMines({
          seed,
          size: {
            rows,
            columns,
            mines: Math.floor((rows * columns * density) / 100),
          },
          safe: clearStart
            ? [start, ...neighboursOf(rows, columns, start)]
            : [start],
        });

        expectSound(field, solveMinesweeper(field, start));
      }),
      { seed: FC_SEED, numRuns: 500 },
    );
  }, 10_000);
});
