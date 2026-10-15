import { evaluateGuess } from "./evaluate";
import type { EvaluatedGuess } from "./keyboard";
import { deriveBoardStatus, type TermoBoardStatus } from "./status";

export interface JudgedBoard {
  readonly rows: readonly EvaluatedGuess[];
  readonly status: TermoBoardStatus;
}

export interface JudgedBoards {
  readonly boards: readonly JudgedBoard[];
  readonly status: TermoBoardStatus;
}

export function judgeBoards(
  guesses: readonly string[],
  answers: readonly string[],
  maxGuesses: number,
): JudgedBoards {
  if (guesses.length > maxGuesses) {
    throw new RangeError(
      `a variant has at most ${String(maxGuesses)} guesses, got ${String(guesses.length)}`,
    );
  }
  const boards = answers.map((answer): JudgedBoard => {
    const rows: EvaluatedGuess[] = [];
    for (const guess of guesses) {
      const tiles = evaluateGuess(guess, answer);
      rows.push({ guess, tiles });
      if (tiles.every((tile) => tile === "correct")) {
        break;
      }
    }
    return {
      rows,
      status: deriveBoardStatus(
        rows.map((row) => row.tiles),
        maxGuesses,
      ),
    };
  });
  const status = boards.every((board) => board.status === "won")
    ? "won"
    : guesses.length === maxGuesses
      ? "lost"
      : "playing";
  return { boards, status };
}
