/**
 * The Termo play slice's vocabulary (#27, plan 022 §14.4). Types only — every
 * value that operates on them lives in `state.ts`, `guess-client.ts` or the
 * shared `../play/` layer.
 *
 * Termo is the first game whose `closed` and `solved` do not coincide, so it
 * is the first producer of `PlayCore.status`'s `"lost"` member — carried
 * there "from day one" by ADR-0029 decision 5 for exactly this ticket.
 */
import type { TermoBoardStatus, TileStates } from "@miolos/games/termo";

import type { LifecycleAction, PlayCore } from "../play/types";
import type { HeldReason } from "./guess-client";

/**
 * One judged row. Structurally the engine's `EvaluatedGuess`, so
 * `deriveKeyboardState(state.guesses)` reads it with no adapter, and the
 * record's own row shape, so `buildRecord` copies it across field by field.
 */
export interface TermoJudgedRow {
  readonly guess: string;
  readonly tiles: TileStates;
}

export interface TermoPlayState extends PlayCore {
  /**
   * Judged rows only, oldest first — but `buildRecord` is a SPREADING copy,
   * not a straight one, and that is measured rather than assumed:
   * `termoTilesSchema` is a `z.tuple` and zod 4.4.3 infers a MUTABLE 5-tuple,
   * while the engine's `TileStates` is `readonly`. Assigning a readonly tuple
   * into the record's mutable one is TS4104/TS2322, even per row. So the
   * write is `state.guesses.map((row) => ({guess: row.guess, tiles:
   * [...row.tiles]}))`, the idiom `use-nonogram-play.ts` already ships.
   * Never an `as`.
   */
  readonly guesses: readonly TermoJudgedRow[];
  /** The letters typed but not yet submitted. NEVER persisted. */
  readonly draft: string;
  /**
   * The guess awaiting a verdict, or null. NEVER persisted: a stored unjudged
   * row could never be filled in — the client has no answer to judge against
   * — so a reload would find a row with no tiles that had already spent one
   * of six attempts (ADR-0039 decision 5).
   */
  readonly pending: string | null;
  /**
   * The visible line under the board. FOUR possible strings: `notInList` (a
   * local rejection AND a 422 `invalid-guess` — the same sentence, because
   * both mean the same thing to the player), `failed` (400/403/415, a 422
   * that is not `invalid-guess` — `board-closed` included — and a turn held
   * because of US: 5xx, 429, a 401 after the one re-mint), `offline` (a turn
   * held because the client can SEE there is no connection), or null.
   *
   * Written ONLY by `submit` and `retry` (clearing) and by the failure
   * branches (setting) — never by `type`, `erase` or `judged`. That is what
   * keeps the two live regions off each other: no single transition writes
   * both this and `announcement` (plan 022 §13.1b).
   */
  readonly notice: string | null;
  /**
   * Incremented on every write to `notice`, including a write of the string
   * already there. `role="status"` is aria-atomic and React does not mutate a
   * text node it is re-writing identically, so without this a second
   * identical rejection is silent.
   */
  readonly noticeNonce: number;
  /** True while a turn is held and the retry button is offered. */
  readonly held: boolean;
  /**
   * The visually-hidden announcer's current sentence. Written ONLY by `type`,
   * `erase` and `judged`. Carries the DRAFT, not just verdicts — the tiles
   * are aria-hidden, so without it a screen-reader user hears nothing at all
   * between the first keypress and `enviar`.
   */
  readonly announcement: string;
  /**
   * The canonical accented answer, written only when the board closes, and
   * copied straight across by `buildRecord`.
   *
   * NO `outcome` FIELD SITS BESIDE IT, and the absence is the decision.
   * `outcome !== undefined` would be exactly `status !== "playing"` — a
   * SECOND terminal predicate beside `PlayCore.status`, which ADR-0029
   * consequence (e) forbids by name. The RECORD's `outcome` is a field
   * (ADR-0044 decision 3), and `buildRecord` DERIVES it from the state it
   * already has: `state.status === "solved" ? "won" : "lost"` — the reducer's
   * own `won → solved` mapping read backwards, needing no engine call.
   */
  readonly answer: string | undefined;
  /**
   * True once the server has told us this day is gone (a 404 from the guess
   * route). It lives HERE rather than in a `useState` beside the reducer, and
   * that is the whole point of this module's opening sentence (finding B-12):
   * a second state authority would put a future "the day went away mid-turn"
   * rule in two places, and would leave `TermoScreen`'s three-way branch
   * order unexercisable through the reducer.
   *
   * Screen-level rather than gameplay, exactly like `hydrated`, `held`,
   * `notice` and `pendingSync`, all of which the reducer already carries.
   */
  readonly gone: boolean;
  // NO `hint` field at all. `HintState` is a standalone interface composed by
  // each game rather than part of `PlayCore`, so Termo simply omits it and
  // `HintState.lastIndex` — "the cell the hint filled", a flat-board index
  // with no Termo meaning — never has to be reinterpreted (ADR-0045
  // decision 2).
}

export type TermoPlayAction =
  | LifecycleAction
  /** One keystroke or one on-screen key. Normalized by the reducer. */
  | { readonly type: "type"; readonly letter: string }
  | { readonly type: "erase" }
  /** Move the draft into the pending row, or reject it locally. */
  | { readonly type: "submit" }
  /** Re-arm a held turn: the same pending guess, posted again. */
  | { readonly type: "retry" }
  /**
   * The turn survives. `reason` is on the action because the notice makes a
   * factual claim about the player's network out of it: `offline` only when
   * the client can actually see that (the fetch rejected, or
   * `navigator.onLine` is false), `server` for 5xx, 429 and a 401 after the
   * one re-mint (finding B-7).
   */
  | { readonly type: "held"; readonly reason: HeldReason }
  /** The server answered 404: this day is gone and can never be judged. */
  | { readonly type: "gone" }
  /** The server refused the WORD, not the board. The turn is not consumed. */
  | {
      readonly type: "rejected";
      readonly reason: "not-in-list" | "refused";
    }
  /**
   * The verdict. ONE action writes `guesses`, `answer` and `status`, and the
   * ordering that forces is the sharpest correctness constraint in the client
   * half — see the reducer's own case.
   */
  | {
      readonly type: "judged";
      readonly guess: string;
      readonly tiles: TileStates;
      readonly status: TermoBoardStatus;
      readonly answer: string | undefined;
    };
