import type { SudokuGrid, SudokuLayout } from "./types";

export function rowOf(i: number): number {
  return (i / 9) | 0;
}

export function colOf(i: number): number {
  return i % 9;
}

function buildPopcount(): readonly number[] {
  const table = new Array<number>(512).fill(0);
  for (let i = 1; i < 512; i += 1) {
    table[i] = table[i >> 1]! + (i & 1);
  }
  return table;
}

export const POPCOUNT: readonly number[] = buildPopcount();

export const ROW_UNITS = 0;

export const COLUMN_UNITS = 9;

export const REGION_UNITS = 18;

export const EXTRA_UNITS = 27;

const MAX_EXTRA_UNITS = 31;

export interface SudokuGeometry {
  readonly units: readonly (readonly number[])[];
  readonly regionOf: readonly number[];
  readonly extraBits: readonly number[];
  readonly unitsOf: readonly (readonly number[])[];
  readonly peers: readonly (readonly number[])[];
}

const CELLS = Array.from({ length: 81 }, (_, i) => i);

export const CLASSIC_LAYOUT: SudokuLayout = Object.freeze({
  regions: Object.freeze(
    CELLS.map((i) => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0)),
  ),
  extraUnits: Object.freeze([]),
});

export const DIAGONAL_LAYOUT: SudokuLayout = Object.freeze({
  regions: CLASSIC_LAYOUT.regions,
  extraUnits: Object.freeze([
    Object.freeze(Array.from({ length: 9 }, (_, k) => k * 10)),
    Object.freeze(Array.from({ length: 9 }, (_, k) => (k + 1) * 8)),
  ]),
});

export function assertSudokuLayout(layout: SudokuLayout): void {
  const { regions, extraUnits } = layout;
  if (
    regions.length !== 81 ||
    !regions.every((id) => Number.isInteger(id) && id >= 0 && id < 9)
  ) {
    throw new RangeError("a Sudoku layout holds 81 region ids in 0..8");
  }
  for (let id = 0; id < 9; id += 1) {
    if (regions.filter((r) => r === id).length !== 9) {
      throw new RangeError(`Sudoku region ${String(id)} must hold 9 cells`);
    }
  }
  if (extraUnits.length > MAX_EXTRA_UNITS) {
    throw new RangeError(
      `a Sudoku layout holds at most ${String(MAX_EXTRA_UNITS)} extra units`,
    );
  }
  for (const unit of extraUnits) {
    if (
      unit.length !== 9 ||
      new Set(unit).size !== 9 ||
      !unit.every((i) => Number.isInteger(i) && i >= 0 && i < 81)
    ) {
      throw new RangeError("an extra Sudoku unit holds 9 distinct cells");
    }
  }
}

export function geometryOf(layout: SudokuLayout): SudokuGeometry {
  assertSudokuLayout(layout);
  const units: (readonly number[])[] = [];
  for (let r = 0; r < 9; r += 1) {
    units.push(CELLS.slice(r * 9, r * 9 + 9));
  }
  for (let c = 0; c < 9; c += 1) {
    units.push(CELLS.filter((i) => colOf(i) === c));
  }
  for (let g = 0; g < 9; g += 1) {
    units.push(CELLS.filter((i) => layout.regions[i] === g));
  }
  units.push(...layout.extraUnits);
  const extraBits = CELLS.map(() => 0);
  layout.extraUnits.forEach((unit, e) => {
    for (const i of unit) {
      extraBits[i] = extraBits[i]! | (1 << e);
    }
  });
  const unitsOf = CELLS.map((i) =>
    units.flatMap((unit, u) => (unit.includes(i) ? [u] : [])),
  );
  const peers = CELLS.map((i) => {
    const seen = new Set<number>();
    for (const unit of units) {
      if (unit.includes(i)) {
        for (const j of unit) {
          if (j !== i) {
            seen.add(j);
          }
        }
      }
    }
    return [...seen];
  });
  return { units, regionOf: [...layout.regions], extraBits, unitsOf, peers };
}

export const CLASSIC_GEOMETRY: SudokuGeometry = geometryOf(CLASSIC_LAYOUT);

function geometryFor(layout: SudokuLayout): SudokuGeometry {
  return layout === CLASSIC_LAYOUT ? CLASSIC_GEOMETRY : geometryOf(layout);
}

export function sudokuPeers(
  index: number,
  layout: SudokuLayout = CLASSIC_LAYOUT,
): readonly number[] {
  return geometryFor(layout).peers[index]!;
}

export function assertSudokuGrid(grid: SudokuGrid): void {
  const shape: unknown = grid;
  if (!Array.isArray(shape)) {
    throw new TypeError("Sudoku grid must be an array");
  }
  if (grid.length !== 81) {
    throw new TypeError(
      `Sudoku grid must have length 81, got ${String(grid.length)}`,
    );
  }
  for (let i = 0; i < 81; i += 1) {
    const value = grid[i]!;
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      throw new TypeError(
        `Sudoku grid cell must be an integer 0-9, got ${String(value)} at index ${String(i)}`,
      );
    }
  }
}

export function getSudokuConflicts(
  grid: SudokuGrid,
  layout: SudokuLayout = CLASSIC_LAYOUT,
): readonly number[] {
  assertSudokuGrid(grid);
  const flagged = new Array<boolean>(81).fill(false);
  for (const unit of geometryFor(layout).units) {
    for (let d = 1; d <= 9; d += 1) {
      let count = 0;
      for (const i of unit) {
        if (grid[i]! === d) {
          count += 1;
        }
      }
      if (count >= 2) {
        for (const i of unit) {
          if (grid[i]! === d) {
            flagged[i] = true;
          }
        }
      }
    }
  }
  const conflicts: number[] = [];
  for (let i = 0; i < 81; i += 1) {
    if (flagged[i]!) {
      conflicts.push(i);
    }
  }
  return Object.freeze(conflicts);
}

export function isSudokuSolved(
  grid: SudokuGrid,
  layout: SudokuLayout = CLASSIC_LAYOUT,
): boolean {
  assertSudokuGrid(grid);
  for (let i = 0; i < 81; i += 1) {
    if (grid[i]! === 0) {
      return false;
    }
  }
  return getSudokuConflicts(grid, layout).length === 0;
}
