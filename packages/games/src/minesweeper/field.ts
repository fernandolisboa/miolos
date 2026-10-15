import { createSeededRandom, shuffleInPlace } from "../random";
import { assertCell, neighbours } from "./internal";
import {
  MINESWEEPER_LEVELS,
  type MinesweeperField,
  type MinesweeperLevel,
} from "./types";

export function layMines(options: {
  readonly seed: number;
  readonly level: MinesweeperLevel;
  readonly safe: number;
}): MinesweeperField {
  const { rows, columns, mines: count } = MINESWEEPER_LEVELS[options.level];
  const cells = rows * columns;
  assertCell(cells, options.safe);

  const candidates = Array.from({ length: cells }, (_, i) => i).filter(
    (i) => i !== options.safe,
  );
  shuffleInPlace(candidates, createSeededRandom(options.seed));

  const mines = new Array<boolean>(cells).fill(false);
  for (const i of candidates.slice(0, count)) {
    mines[i] = true;
  }
  const counts = mines.map(
    (_, i) => neighbours(rows, columns, i).filter((n) => mines[n]).length,
  );
  return { rows, columns, mines, counts };
}
