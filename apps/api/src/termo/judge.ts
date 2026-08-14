import {
  deriveBoardStatus,
  evaluateGuess,
  MAX_GUESSES,
  type TermoBoardStatus,
  type TileStates,
} from "@miolos/games/termo";

/**
 * The ONE Termo judging ladder, shared by `POST /termo/guess` and
 * `POST /completions` (#27 step-7 finding A-2).
 *
 * It was written twice — once in each route, under a TSDoc that said "if
 * either changes, change both". That is the shape ADR-0038 **decision 8**
 * rejects one decision earlier, hoisting the write window into
 * `src/publishing/dates.ts` because "two copies of the bound would drift"
 * (that bound is `isWritableDate` since #31 removed its lower half; the
 * one-copy rule is what survived, ADR-0053),
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
 *   member by construction.
 *
 * `POST /termo/guess` therefore checks `isValidGuess` on the NEWEST guess
 * only — the one the player just typed, the only one whose rejection is a
 * player outcome — and `POST /completions` checks none.
 *
 * STATED PRECISELY, because an earlier draft of this comment said the client
 * "only cheats itself" and that is false (#27 round-2 finding D-8): an
 * earlier non-word IS judged, and the guess route RETURNS its tiles —
 * `T-API-S42` pins exactly that. So any `^[a-z]{5}$` string is probeable, not
 * just dictionary words. That is an accepted cost rather than a new one: the
 * route is stateless with no server-side turn accounting, so unlimited
 * probing of *dictionary* words was already free under ADR-0038
 * consequence (a), and ADR-0038 decision 9 already disclaims this route as a
 * confidentiality boundary. The gate is not coming back — restoring it
 * reopens the soft-lock above, whose cost is a permanently lost day.
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
 *
 * THE OTHER `RangeError` IS GUARDED TOO (#27 round-2 finding G-1).
 * `deriveBoardStatus` throws on `rows.length > MAX_GUESSES` as well as on a
 * row after a win, and an earlier draft of this module guarded only the
 * second — safe, because both callers cap the list at six through zod before
 * calling, but safe by a precondition living in the callers rather than here.
 * That is precisely what the A-2 hoist exists to end: the whole point of one
 * judge is that its gates are in one place, so a third caller or a relaxed
 * `.max()` cannot turn into a 500. An over-length list is `null` for the same
 * reason a post-win row is — it does not derive a closed board — and the two
 * callers keep naming it in their own vocabulary.
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
