import {
  deriveBoardStatus,
  evaluateGuess,
  MAX_GUESSES,
  type TermoBoardStatus,
  type TileStates,
} from "@miolos/games/termo";

export interface TermoJudgement {
  readonly tiles: readonly TileStates[];
  readonly status: TermoBoardStatus;
}

export function judgeGuessList(
  guesses: readonly string[],
  answer: string,
): TermoJudgement | null {
  if (guesses.length > MAX_GUESSES) {
    return null;
  }

  const winAt = guesses.findIndex((guess) => guess === answer);
  if (winAt !== -1 && winAt !== guesses.length - 1) {
    return null;
  }

  const tiles = guesses.map((guess) => evaluateGuess(guess, answer));
  return { tiles, status: deriveBoardStatus(tiles) };
}
