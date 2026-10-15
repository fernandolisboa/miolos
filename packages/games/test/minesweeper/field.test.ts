import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MINESWEEPER_LEVELS,
  layMines,
  type MinesweeperLevel,
} from "../../src/minesweeper/index";
import { neighboursOf } from "./fixtures";

const levelArb = fc.constantFrom<MinesweeperLevel>(
  "beginner",
  "intermediate",
  "expert",
);
const seedArb = fc.integer({ min: 0, max: 0xffffffff });

const layoutArb = levelArb.chain((level) => {
  const { rows, columns } = MINESWEEPER_LEVELS[level];
  return fc.record({
    level: fc.constant(level),
    seed: seedArb,
    safe: fc.integer({ min: 0, max: rows * columns - 1 }),
  });
});

function render(mines: readonly boolean[], columns: number): string {
  const rows: string[] = [];
  for (let i = 0; i < mines.length; i += columns) {
    rows.push(
      mines
        .slice(i, i + columns)
        .map((mine) => (mine ? "*" : "."))
        .join(""),
    );
  }
  return rows.join(" ");
}

describe("MINESWEEPER_LEVELS", () => {
  it("are the three Windows levels, expert landscape", () => {
    expect(MINESWEEPER_LEVELS).toEqual({
      beginner: { rows: 9, columns: 9, mines: 10 },
      intermediate: { rows: 16, columns: 16, mines: 40 },
      expert: { rows: 16, columns: 30, mines: 99 },
    });
  });
});

describe("layMines", () => {
  it("lays exactly the level's mines, never on the safe cell", () => {
    fc.assert(
      fc.property(layoutArb, ({ level, seed, safe }) => {
        const field = layMines({ seed, level, safe });
        const { rows, columns, mines } = MINESWEEPER_LEVELS[level];

        expect(field.rows).toBe(rows);
        expect(field.columns).toBe(columns);
        expect(field.mines).toHaveLength(rows * columns);
        expect(field.mines.filter(Boolean)).toHaveLength(mines);
        expect(field.mines[safe]).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it("is deterministic for the same seed and safe cell", () => {
    fc.assert(
      fc.property(layoutArb, (layout) => {
        expect(layMines(layout)).toEqual(layMines(layout));
      }),
      { numRuns: 200 },
    );
  });

  it("numbers every cell with its neighbour mine count", () => {
    fc.assert(
      fc.property(layoutArb, ({ level, seed, safe }) => {
        const field = layMines({ seed, level, safe });
        const expected = field.mines.map(
          (_, i) =>
            neighboursOf(field.rows, field.columns, i).filter(
              (n) => field.mines[n],
            ).length,
        );

        expect(field.counts).toEqual(expected);
      }),
      { numRuns: 300 },
    );
  });

  it("pins the literal beginner layout for one seed", () => {
    const field = layMines({ seed: 20_261_015, level: "beginner", safe: 40 });

    expect(render(field.mines, field.columns)).toBe(
      ".*....... *........ ..*...... ......... ...*..... ......... *..*....* ...*...** .........",
    );
  });

  it("rejects a safe cell outside the board", () => {
    expect(() => layMines({ seed: 1, level: "beginner", safe: 81 })).toThrow(
      RangeError,
    );
    expect(() => layMines({ seed: 1, level: "beginner", safe: -1 })).toThrow(
      RangeError,
    );
    expect(() => layMines({ seed: 1, level: "beginner", safe: 1.5 })).toThrow(
      RangeError,
    );
  });
});
