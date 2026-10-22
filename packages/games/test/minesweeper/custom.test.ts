import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  MINESWEEPER_CUSTOM_LIMITS,
  MINESWEEPER_LEVELS,
  customMinesweeperSize,
  newMinesweeperGame,
  openMinesweeperCell,
} from "../../src/minesweeper/index";

const anyNumber = fc.oneof(
  fc.double(),
  fc.integer({ min: -100, max: 1000 }),
  fc.constantFrom(Number.NaN, Infinity, -Infinity, 0, -0),
);

const {
  rows: ROWS,
  columns: COLUMNS,
  mines: MINES,
} = MINESWEEPER_CUSTOM_LIMITS;

const maxMines = (rows: number, columns: number) => (rows - 1) * (columns - 1);

describe("MINESWEEPER_CUSTOM_LIMITS", () => {
  it("are Windows' limits: 9–24 rows, 9–30 columns, at least 10 mines", () => {
    expect(MINESWEEPER_CUSTOM_LIMITS).toEqual({
      rows: { min: 9, max: 24 },
      columns: { min: 9, max: 30 },
      mines: { min: 10 },
    });
  });
});

describe("customMinesweeperSize", () => {
  it("lands any number, NaN and the infinities included, on whole numbers inside the limits", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (r, c, m) => {
        const { rows, columns, mines } = customMinesweeperSize(r, c, m);

        expect(Number.isInteger(rows)).toBe(true);
        expect(Number.isInteger(columns)).toBe(true);
        expect(Number.isInteger(mines)).toBe(true);
        expect(rows).toBeGreaterThanOrEqual(ROWS.min);
        expect(rows).toBeLessThanOrEqual(ROWS.max);
        expect(columns).toBeGreaterThanOrEqual(COLUMNS.min);
        expect(columns).toBeLessThanOrEqual(COLUMNS.max);
        expect(mines).toBeGreaterThanOrEqual(MINES.min);
        expect(mines).toBeLessThanOrEqual(maxMines(rows, columns));
      }),
      { numRuns: 500 },
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(anyNumber, anyNumber, anyNumber, (r, c, m) => {
        const once = customMinesweeperSize(r, c, m);

        expect(
          customMinesweeperSize(once.rows, once.columns, once.mines),
        ).toEqual(once);
      }),
      { numRuns: 500 },
    );
  });

  it("keeps a size already inside the limits, and every Windows level", () => {
    const inside = fc
      .record({
        rows: fc.integer({ min: ROWS.min, max: ROWS.max }),
        columns: fc.integer({ min: COLUMNS.min, max: COLUMNS.max }),
      })
      .chain(({ rows, columns }) =>
        fc.record({
          rows: fc.constant(rows),
          columns: fc.constant(columns),
          mines: fc.integer({ min: MINES.min, max: maxMines(rows, columns) }),
        }),
      );
    fc.assert(
      fc.property(inside, (size) => {
        expect(
          customMinesweeperSize(size.rows, size.columns, size.mines),
        ).toEqual(size);
      }),
      { numRuns: 300 },
    );
    for (const level of Object.values(MINESWEEPER_LEVELS)) {
      expect(
        customMinesweeperSize(level.rows, level.columns, level.mines),
      ).toEqual(level);
    }
  });

  it("clamps out of range, truncates fractions and takes the minimum for NaN", () => {
    expect(customMinesweeperSize(100, 100, 10_000)).toEqual({
      rows: 24,
      columns: 30,
      mines: 667,
    });
    expect(customMinesweeperSize(0, -5, 0)).toEqual({
      rows: 9,
      columns: 9,
      mines: 10,
    });
    expect(customMinesweeperSize(12.9, 15.5, 30.99)).toEqual({
      rows: 12,
      columns: 15,
      mines: 30,
    });
    expect(customMinesweeperSize(Number.NaN, Number.NaN, Number.NaN)).toEqual({
      rows: 9,
      columns: 9,
      mines: 10,
    });
    expect(customMinesweeperSize(9, 9, 100)).toEqual({
      rows: 9,
      columns: 9,
      mines: 64,
    });
  });

  it("deals every clamped size with a safe first open and exactly its mines", () => {
    fc.assert(
      fc.property(
        anyNumber,
        anyNumber,
        anyNumber,
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.nat(),
        (r, c, m, seed, at) => {
          const size = customMinesweeperSize(r, c, m);
          const start = at % (size.rows * size.columns);
          const opened = openMinesweeperCell(
            newMinesweeperGame(size, seed),
            start,
          );

          expect(opened.status).not.toBe("lost");
          expect(opened.open[start]).toBe(true);
          expect(opened.field?.mines.filter(Boolean)).toHaveLength(size.mines);
          expect(opened.field?.mines[start]).toBe(false);
        },
      ),
      { numRuns: 300 },
    );
  });
});
