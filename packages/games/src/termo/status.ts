import { type TileStates } from "./evaluate";

export const MAX_GUESSES = 6;

export type TermoBoardStatus = "playing" | "won" | "lost";

function isWinningRow(row: TileStates): boolean {
  return row.every((tile) => tile === "correct");
}

export function deriveBoardStatus(
  rows: readonly TileStates[],
): TermoBoardStatus {
  if (rows.length > MAX_GUESSES) {
    throw new RangeError(
      `a board has at most ${String(MAX_GUESSES)} rows, got ${String(rows.length)}`,
    );
  }
  const winIndex = rows.findIndex(isWinningRow);
  if (winIndex !== -1) {
    if (winIndex !== rows.length - 1) {
      throw new RangeError(
        `row ${String(winIndex + 1)} is a win but ${String(rows.length - winIndex - 1)} row(s) follow it — guessing past a win is a caller bug`,
      );
    }
    return "won";
  }
  return rows.length === MAX_GUESSES ? "lost" : "playing";
}
