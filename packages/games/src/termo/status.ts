import { type TileStates } from "./evaluate";

export const MAX_GUESSES = 6;

/**
 * Board-level status only. Day-level semantics (won ⇒ Completed if on-time;
 * lost ⇒ Played, fail row of the distribution — ADR-0008 rules 3-4) are
 * server interpretations of won/lost and ship with #27. The name is
 * TermoBoardStatus, not game/day status, to keep that line sharp.
 */
export type TermoBoardStatus = "playing" | "won" | "lost";

function isWinningRow(row: TileStates): boolean {
  return row.every((tile) => tile === "correct");
}

/**
 * won: some row is all-correct. lost: MAX_GUESSES rows and none all-correct.
 * playing: otherwise. Throws RangeError if rows.length > MAX_GUESSES or if a
 * row after an all-correct row exists (guessing past a win is a caller bug).
 */
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
