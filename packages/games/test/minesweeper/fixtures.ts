import type {
  MinesweeperField,
  MinesweeperState,
} from "../../src/minesweeper/index";

export function neighboursOf(
  rows: number,
  columns: number,
  index: number,
): number[] {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      const r = row + dr;
      const c = column + dc;
      if (
        (dr !== 0 || dc !== 0) &&
        r >= 0 &&
        r < rows &&
        c >= 0 &&
        c < columns
      ) {
        result.push(r * columns + c);
      }
    }
  }
  return result;
}

export function fieldFrom(
  rows: number,
  columns: number,
  mineIndexes: readonly number[],
): MinesweeperField {
  const mines = Array.from({ length: rows * columns }, (_, i) =>
    mineIndexes.includes(i),
  );
  const counts = mines.map(
    (_, i) => neighboursOf(rows, columns, i).filter((n) => mines[n]).length,
  );
  return { rows, columns, mines, counts };
}

export function beginnerPlaying(
  mineIndexes: readonly number[],
): MinesweeperState {
  const field = fieldFrom(9, 9, mineIndexes);
  return {
    size: { rows: 9, columns: 9, mines: mineIndexes.length },
    field,
    open: field.mines.map(() => false),
    marks: field.mines.map(() => null),
    status: "playing",
    hit: null,
  };
}
