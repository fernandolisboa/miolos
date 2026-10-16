import { createSeededRandom, shuffleInPlace } from "../random";
import { assertCell, neighbours } from "./internal";
import type { MinesweeperField, MinesweeperSize } from "./types";

export function minesweeperField(
  rows: number,
  columns: number,
  mines: readonly boolean[],
): MinesweeperField {
  const counts = mines.map(
    (_, i) => neighbours(rows, columns, i).filter((n) => mines[n]).length,
  );
  return { rows, columns, mines, counts };
}

export function layMines(options: {
  readonly seed: number;
  readonly size: MinesweeperSize;
  readonly safe: readonly number[];
}): MinesweeperField {
  const { rows, columns, mines: count } = options.size;
  const cells = rows * columns;
  for (const cell of options.safe) {
    assertCell(cells, cell);
  }

  const safe = new Set(options.safe);
  const candidates = Array.from({ length: cells }, (_, i) => i).filter(
    (i) => !safe.has(i),
  );
  if (candidates.length < count) {
    throw new RangeError(
      `${String(count)} mines do not fit in ${String(candidates.length)} cells`,
    );
  }
  shuffleInPlace(candidates, createSeededRandom(options.seed));

  const mines = new Array<boolean>(cells).fill(false);
  for (const i of candidates.slice(0, count)) {
    mines[i] = true;
  }
  return minesweeperField(rows, columns, mines);
}
