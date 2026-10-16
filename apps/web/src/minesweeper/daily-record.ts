import type { DailyMinesweeperResponse } from "@miolos/core";
import {
  minesweeperField,
  startMinesweeper,
  type MinesweeperState,
  type MinesweeperStatus,
} from "@miolos/games/minesweeper";

import {
  MINESWEEPER_ENTRIES,
  type MinesweeperPlayRecord,
} from "../play/play-record";

export function startedGame(daily: DailyMinesweeperResponse): MinesweeperState {
  const field = minesweeperField(
    daily.rows,
    daily.columns,
    daily.mines.map((cell) => cell === 1),
  );
  return startMinesweeper(field, daily.start);
}

function recordedStatus(record: MinesweeperPlayRecord): MinesweeperStatus {
  if (record.hit === undefined) {
    return "playing";
  }
  return record.hit === null ? "won" : "lost";
}

export function gameOfRecord(
  started: MinesweeperState,
  record: MinesweeperPlayRecord,
): MinesweeperState {
  const cells = record.entries.map(
    (entry) => MINESWEEPER_ENTRIES[entry] ?? MINESWEEPER_ENTRIES[0],
  );
  return {
    ...started,
    open: cells.map((cell) => cell.open),
    marks: cells.map((cell) => cell.mark),
    status: recordedStatus(record),
    hit: record.hit ?? null,
  };
}

export function entriesOf(
  game: MinesweeperState,
): MinesweeperPlayRecord["entries"] {
  return game.open.map((open, index) => {
    const mark = open ? null : (game.marks[index] ?? null);
    return MINESWEEPER_ENTRIES.findIndex(
      (cell) => cell.open === open && cell.mark === mark,
    );
  });
}
