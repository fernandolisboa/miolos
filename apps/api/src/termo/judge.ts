import {
  deriveBoardStatus,
  evaluateGuess,
  MAX_GUESSES,
  type TermoBoardStatus,
  type TileStates,
} from "@miolos/games/termo";

/**
 * The ONE Termo judging ladder, shared by `POST /termo/guess` and
 * `POST /completions` — a gate added to the guess route alone would let
 * `POST /completions` record a write-once `lost` row for a board the guess
 * route never closed.
 *
 * THE DICTIONARY GATE IS DELIBERATELY NOT HERE, and must not be re-added
 * over the accumulated guess list. `POST /termo/guess` is stateless
 * (ADR-0038 decision 1) and re-posts every earlier guess on every turn,
 * while the dictionary (ADR-0015) is regenerated independently of
 * `apps/web` — so a word the client accepted and the server later dropped
 * is a real, reachable state. Gating the whole list would turn that into a
 * soft-lock: every later guess rejected because of an earlier one, and
 * `POST /completions` then 422s forever — 422 is terminal in
 * `apps/web/src/play/sync.ts`, so that would cost the day permanently. It
 * also buys nothing: the win test is `guess === answer`, and a non-word
 * earlier in the list cannot manufacture one. The newest-guess dictionary
 * check lives in the guess route itself, not here.
 */
export interface TermoJudgement {
  /** Parallel to the submitted guesses, in the submitted order. */
  readonly tiles: readonly TileStates[];
  readonly status: TermoBoardStatus;
}

/**
 * Judges a whole guess list against the stored NORMALIZED answer, or
 * returns `null` when the list does not derive a closed board — a row past
 * a winning row, or more rows than `MAX_GUESSES`. `deriveBoardStatus`
 * throws a `RangeError` on both, which is reachable from a hostile body
 * and would otherwise reach a route handler as a 500; each caller
 * translates `null` into its own 422 instead (`board-closed`,
 * `guess-mismatch`).
 *
 * The win check needs no tiles: `evaluateGuess` only ever writes "correct"
 * when the guess equals the answer, so a plain string compare is exact.
 */
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
