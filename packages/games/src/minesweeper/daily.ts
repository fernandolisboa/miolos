import { createSeededRandom } from "../random";
import { assertWeekday, isWeekday, type Weekday } from "../weekday";
import { layMines, minesweeperField } from "./field";
import { neighbours } from "./internal";
import { startMinesweeper } from "./play";
import { solveMinesweeper } from "./solve";
import {
  MinesweeperGenerationError,
  type MinesweeperDaily,
  type MinesweeperRejectionReason,
  type MinesweeperValidationResult,
} from "./types";

export const MINESWEEPER_DAILY_SIZE = { rows: 16, columns: 10 } as const;

export const MINESWEEPER_WEEKDAY_MINES: Readonly<Record<Weekday, number>> = {
  1: 20,
  2: 22,
  3: 24,
  4: 26,
  5: 28,
  6: 30,
  7: 32,
};

const MAX_ATTEMPTS = 128;
const MIN_CLOSED_SAFE_CELLS = 40;

function clearing(start: number): number[] {
  const { rows, columns } = MINESWEEPER_DAILY_SIZE;
  return [start, ...neighbours(rows, columns, start)];
}

function isMalformed(puzzle: MinesweeperDaily): boolean {
  const { rows, columns } = MINESWEEPER_DAILY_SIZE;
  return (
    !isWeekday(puzzle.weekday) ||
    !Array.isArray(puzzle.mines) ||
    puzzle.mines.length !== rows * columns ||
    !puzzle.mines.every((mine) => mine === 0 || mine === 1) ||
    !Number.isInteger(puzzle.start) ||
    puzzle.start < 0 ||
    puzzle.start >= rows * columns
  );
}

export function validateMinesweeperDaily(
  puzzle: MinesweeperDaily,
): MinesweeperValidationResult {
  const { rows, columns } = MINESWEEPER_DAILY_SIZE;
  if (puzzle.rows !== rows || puzzle.columns !== columns) {
    return { ok: false, failures: ["size-mismatch"] };
  }
  if (isMalformed(puzzle)) {
    return { ok: false, failures: ["malformed"] };
  }
  const field = minesweeperField(
    rows,
    columns,
    puzzle.mines.map((mine) => mine === 1),
  );
  const failures: MinesweeperRejectionReason[] = [];
  if (
    puzzle.mines.filter((mine) => mine === 1).length !==
    MINESWEEPER_WEEKDAY_MINES[puzzle.weekday]
  ) {
    failures.push("mine-count");
  }
  const startClear = clearing(puzzle.start).every((cell) => !field.mines[cell]);
  if (!startClear) {
    failures.push("start-not-clear");
  }
  const opened = startMinesweeper(field, puzzle.start).open;
  const closedSafe = field.mines.filter(
    (mine, cell) => !mine && !opened[cell],
  ).length;
  if (closedSafe < MIN_CLOSED_SAFE_CELLS) {
    failures.push("opens-too-much");
  }
  if (startClear && solveMinesweeper(field, puzzle.start).status !== "won") {
    failures.push("needs-a-guess");
  }
  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export function generateMinesweeperDaily(options: {
  seed: number;
  weekday: Weekday;
}): MinesweeperDaily {
  const seed = options.seed >>> 0;
  const weekday = assertWeekday(options.weekday);
  const { rows, columns } = MINESWEEPER_DAILY_SIZE;
  const size = { rows, columns, mines: MINESWEEPER_WEEKDAY_MINES[weekday] };
  const stream = createSeededRandom(seed);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const layout = Math.floor(stream.next() * 0x100000000);
    const start = stream.nextInt(rows * columns);
    const field = layMines({ seed: layout, size, safe: clearing(start) });
    const puzzle: MinesweeperDaily = {
      seed,
      weekday,
      rows,
      columns,
      mines: field.mines.map((mine) => (mine ? 1 : 0)),
      start,
    };
    if (validateMinesweeperDaily(puzzle).ok) {
      return puzzle;
    }
  }
  throw new MinesweeperGenerationError(seed, weekday, MAX_ATTEMPTS);
}
