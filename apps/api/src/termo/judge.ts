import {
  deriveBoardStatus,
  evaluateGuess,
  type TermoBoardStatus,
  type TileStates,
} from "@miolos/games/termo";

/**
 * The ONE Termo judging ladder, shared by `POST /termo/guess` and
 * `POST /completions` (#27 step-7 finding A-2).
 *
 * It was written twice — once in each route, under a TSDoc that said "if
 * either changes, change both". That is the shape ADR-0038 **decision 8**
 * rejects one decision earlier, hoisting `ACCEPTED_DAYS_BACK` into
 * `src/publishing/dates.ts` because "two copies of the bound would drift",
 * and the drift here is worse than a widened window: a gate added to the
 * guess route alone would let `POST /completions` record a write-once
 * (ADR-0026 decision 1) `lost` row for a board the guess route would never
 * have closed. The module lives beside that precedent, in `apps/api/src`,
 * which is still the route layer.
 *
 * THE DICTIONARY GATE IS DELIBERATELY NOT HERE (finding A-1). It is not
 * "forgotten" and it is not the caller's to re-add over the whole list:
 *
 * - ADR-0038 decision 1 makes the client stateless, so it re-posts every
 *   earlier guess on every turn. `apps/web` and `apps/api` are separate
 *   Vercel projects that deploy independently, and ADR-0015 expects
 *   `validation.txt` to be regenerated — so a word accepted by the client's
 *   copy and dropped from the server's is a REAL, reachable state. Gating on
 *   the accumulated list turns it into a soft-lock: every later guess is
 *   rejected because of an earlier one, and the completion POST then 422s
 *   forever (422 is terminal in `apps/web/src/play/sync.ts`), costing the
 *   day permanently.
 * - It buys nothing. A non-word EARLIER in the list cannot manufacture a
 *   win: the win test is `guess === answer` and the answer is a dictionary
 *   member by construction. A client that posts junk earlier guesses only
 *   cheats itself, which ADR-0038 consequence (a) already accepts for the
 *   six-guess limit.
 *
 * `POST /termo/guess` therefore checks `isValidGuess` on the NEWEST guess
 * only — the one the player just typed, the only one whose rejection is a
 * player outcome — and `POST /completions` checks none.
 */
export interface TermoJudgement {
  /** Parallel to the submitted guesses, in the submitted order. */
  readonly tiles: readonly TileStates[];
  readonly status: TermoBoardStatus;
}

/**
 * Judge a whole guess list against the stored NORMALIZED answer, or `null`
 * when the list continues past a winning row.
 *
 * `null` is not a nicety: `deriveBoardStatus` throws a `RangeError` on a row
 * following a win (`packages/games/src/termo/status.ts:31-36`), that case is
 * reachable from a hostile body, and an uncaught `RangeError` in a route
 * handler is a 500. The check runs BEFORE the call, exactly as ADR-0032 puts
 * the length check before the compare loop for the same class of reason. The
 * two callers give the same fact two different names, because it means two
 * different things to them: 422 `board-closed` on the guess route (a client
 * bug or tampering mid-game), 422 `guess-mismatch` on the completion route
 * (a list that does not derive a closed board).
 *
 * The pre-check needs no tiles, because "all five correct" ⟺ "the guess
 * equals the answer": `evaluateGuess` writes "correct" in exactly one place —
 * pass 1's `if (letter === a.charAt(i))` — and pass 2 never writes it. Both
 * operands are `^[a-z]{5}$` (the request schemas for the guess, the word-list
 * harness for `normalized`), so this is plain ASCII equality and the check is
 * EXACT rather than conservative: it can never reject a legitimate board.
 */
export function judgeGuessList(
  guesses: readonly string[],
  answer: string,
): TermoJudgement | null {
  const winAt = guesses.findIndex((guess) => guess === answer);
  if (winAt !== -1 && winAt !== guesses.length - 1) {
    return null;
  }

  const tiles = guesses.map((guess) => evaluateGuess(guess, answer));
  return { tiles, status: deriveBoardStatus(tiles) };
}
