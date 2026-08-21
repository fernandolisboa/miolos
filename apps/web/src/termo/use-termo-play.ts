/**
 * The React seam over the pure reducer (#27, plan 022 §14.4/§14.5).
 * Everything decidable without React lives in `state.ts`; everything a play
 * screen does that is not gameplay lives in `usePlayLifecycle` (ADR-0029),
 * which Termo reuses UNCHANGED — read in full it names no cell, no index and
 * no size, and its only structural constraints are `S extends PlayCore` and a
 * caller-supplied `persistDeps`.
 *
 * The rule that carries over from the three shipped games unchanged: nothing
 * here runs during render. `localStorage` is read once, in the lifecycle's
 * mount effect; `Date.now()` appears only inside effects and event handlers.
 *
 * THE TIMER KEEPS RUNNING THROUGH A NETWORK STALL, deliberately. Pausing it
 * would add a second pause authority beside the `visibilitychange`/`pagehide`
 * path in a module ADR-0029 decision 2 makes shared. Termo's `elapsedMs`
 * therefore includes every per-guess round trip and is NOT comparable to a
 * grid time — which is one of the two reasons the number is never rendered
 * (ADR-0045 decision 4) and why this hook exposes no `elapsed` at all.
 *
 * `progress.ts` IS NOT REUSED. `countFilled(givens, entries)` takes two
 * parallel index-aligned arrays and tests `!== null`; Termo has no `givens`
 * and no null-empty cell array. `progress.ts` already records that Nonogram
 * deliberately did not reuse it either, calling that "the shallow reuse
 * ADR-0029 rejects". Same verdict, second time.
 */
import type { DailyTermoResponse } from "@miolos/core";
import { deriveKeyboardState, type KeyboardState } from "@miolos/games/termo";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { TermoPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { postGuesses } from "./guess-client";
import { initTermoPlayState, termoPlayReducer } from "./state";
import type { TermoPlayAction, TermoPlayState } from "./types";

/** Everything the play composition needs, and nothing it does not. */
export interface TermoPlay {
  readonly state: TermoPlayState;
  /** Guesses spent — the readout's numerator. */
  readonly used: number;
  /**
   * The row the player is writing into, or null while a turn is in flight or
   * the board is closed. A held turn owns its row instead (`heldRow`), and
   * the two are never both set.
   */
  readonly activeRow: number | null;
  /** The row holding a submitted, unjudged guess, or null. */
  readonly heldRow: number | null;
  /** Best-known state per letter across every judged guess. */
  readonly keyboardState: KeyboardState;
  /**
   * True once the server has told us this day is gone (404). The screen swaps
   * to the same `DailyUnavailable` view the route renders when the wall
   * returns nothing (ADR-0028 decision 4).
   *
   * Read straight off `state.gone`: the reducer is the ONE state authority on
   * this screen (finding B-12), so the three-way branch `TermoScreen` makes
   * out of it is exercisable from `termo-state.test.ts` without React.
   */
  readonly unavailable: boolean;
  readonly type: (letter: string) => void;
  readonly erase: () => void;
  readonly submit: () => void;
  /** Re-post a held turn. Offered only while `state.held`. */
  readonly retry: () => void;
  /**
   * Freeze the clock from OUTSIDE the lifecycle (#142 step 7): the screen
   * root calls this when the server's claim wins the screen, so the 1 Hz
   * tick stops behind the remote conclusion and the preserved in-progress
   * record's `elapsedMs` stops growing. Idempotent — `pause` on a paused
   * timer is the timer reducer's no-op.
   */
  readonly pause: () => void;
}

/**
 * `remotelyClaimed` — the SERVER already claims this game on this day (#33,
 * ADR-0069), which the daily screen root reads with `useServerDayClaim` for
 * its own render-time swap to the remote completed view (#142, ADR-0065).
 * It travels as a parameter rather than being read here because
 * `play/day-state.ts` reaches `src/day/**`, and the ARCHIVE shell — which
 * calls this same hook — may contain neither in its module graph (ADR-0053
 * decision 10's "Why no endpoint", pinned by `archive-day.test.tsx`). Its only effect is to
 * suppress the `puzzle_started` report: looking at a finished day is not
 * starting an attempt. The archive omits it; an archived date's claim is
 * `undefined` by the payload's own date gate anyway.
 */
export function useTermoPlay(
  daily: DailyTermoResponse,
  remotelyClaimed = false,
): TermoPlay {
  const [state, dispatch] = useReducer(
    termoPlayReducer,
    daily,
    initTermoPlayState,
  );

  // Event handlers need the CURRENT state without re-registering listeners on
  // every keystroke; a ref synced each commit is the cheapest honest way.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  usePlayLifecycle({
    game: "termo",
    state,
    reduce: termoPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    // `[state.guesses]` AND NOTHING ELSE. The array identity changes on a
    // judged guess and on nothing else, which is exactly "the record's
    // CONTENT changed".
    //
    // `state.draft` must NOT be here: every keystroke would cost a
    // readPlayRecord + Zod parse + JSON.stringify + setItem cycle, thirty
    // times a game, to persist letters the record deliberately does not
    // carry. `state.pending` must not either — an un-judged guess never
    // reaches storage (ADR-0039 decision 5). And `state.now` must never be
    // here, which `T-WEB-S33` pins on the shared hook. T-WEB-S84/S85.
    persistDeps: [state.guesses],
  });

  /**
   * Post the pending guess of a state that has ALREADY absorbed the
   * transition arming it. The caller reduces locally and dispatches the same
   * action — the reducer is pure, so the two cannot diverge, and it is the
   * idiom `use-play-lifecycle.ts`'s `pagehide` handler already ships.
   */
  const send = useCallback(async (armed: TermoPlayState) => {
    const pending = armed.pending;
    if (pending === null) {
      return;
    }
    // STATELESS by construction (ADR-0038 decision 1): the whole list, every
    // time, so a lost response costs a re-post rather than a turn.
    const words = [...armed.guesses.map((row) => row.guess), pending];
    const outcome = await postGuesses(armed.date, words);

    switch (outcome.kind) {
      case "judged": {
        const tiles = outcome.tiles.at(-1);
        if (tiles === undefined || outcome.tiles.length !== words.length) {
          // The server judged a different list than the one we posted. That
          // is a server bug, not a player error, so the turn is HELD and
          // stays re-postable — never judged against a row that is not ours.
          console.error(
            `a termo verdict carried ${String(outcome.tiles.length)} rows for ${String(words.length)} guesses; the turn is held`,
          );
          // `server`, unambiguously: the response arrived and it was wrong.
          dispatch({ type: "held", reason: "server" });
          return;
        }
        dispatch({
          type: "judged",
          guess: pending,
          tiles,
          status: outcome.status,
          answer: outcome.answer,
        });
        return;
      }
      case "held":
        dispatch({ type: "held", reason: outcome.reason });
        return;
      case "rejected":
        dispatch({ type: "rejected", reason: outcome.reason });
        return;
      case "gone":
        dispatch({ type: "gone" });
        return;
    }
  }, []);

  /**
   * Reduce locally, dispatch the same action, and post from the reduced
   * value. The reducer is pure, so computing the armed snapshot and
   * dispatching the same action cannot diverge — the idiom
   * `use-play-lifecycle.ts`'s `pagehide` handler already ships.
   */
  const arm = useCallback(
    (action: Extract<TermoPlayAction, { type: "submit" | "retry" }>) => {
      const current = stateRef.current;
      const next = termoPlayReducer(current, action);
      if (next === current) {
        return;
      }
      stateRef.current = next;
      dispatch(action);
      // Only a transition that actually armed a turn posts one. Reading
      // `next.pending` is what keeps the local `isValidGuess` decision in ONE
      // place — the reducer — rather than in a second copy here that could
      // drift from it.
      if (next.pending !== null) {
        void send(next);
      }
    },
    [send],
  );

  const type = useCallback((letter: string) => {
    dispatch({ type: "type", letter });
  }, []);

  const erase = useCallback(() => {
    dispatch({ type: "erase" });
  }, []);

  const submit = useCallback(() => {
    arm({ type: "submit" });
  }, [arm]);

  const retry = useCallback(() => {
    arm({ type: "retry" });
  }, [arm]);

  // The automatic half of ADR-0039's retry: a turn held offline goes as soon
  // as the connection returns, without the player pressing anything. Torn
  // down with the screen. `retry` no-ops unless a turn is actually held, so
  // this cannot double-post.
  useEffect(() => {
    const onOnline = () => {
      retry();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [retry]);

  const keyboardState = useMemo(
    () => deriveKeyboardState(state.guesses),
    [state.guesses],
  );

  const live = state.status === "playing";
  // Freeze the clock from OUTSIDE the lifecycle (#142 step 7): the screen
  // root calls this when the server's claim wins the screen, so the 1 Hz
  // tick stops behind the remote conclusion and the preserved in-progress
  // record's `elapsedMs` stops growing. Idempotent — `pause` on a paused
  // timer is the timer reducer's no-op.
  const pause = useCallback(() => {
    dispatch({ type: "pause", now: Date.now() });
  }, []);

  return {
    state,
    used: state.guesses.length,
    activeRow: live && state.pending === null ? state.guesses.length : null,
    heldRow: state.pending === null ? null : state.guesses.length,
    keyboardState,
    unavailable: state.gone,
    type,
    erase,
    submit,
    retry,
    pause,
  };
}

/**
 * The one place a Termo `PlayRecord` is constructed, handed to the lifecycle
 * hook so both the in-progress write and the closing one go through it.
 * MODULE-LEVEL, so the hook's ref is stable.
 *
 * IT IS A SPREADING COPY, not a straight one, and that was measured rather
 * than guessed: the record's `tiles` is a `z.tuple`, which zod 4.4.3 infers
 * as a MUTABLE 5-tuple, while the engine's `TileStates` is `readonly`.
 * Assigning a readonly tuple into the mutable one is TS4104/TS2322 even per
 * row, so each row is rebuilt with `[...row.tiles]` — the idiom
 * `use-nonogram-play.ts` already ships. Never an `as`.
 *
 * `answer` and `outcome` are written ONLY on the closing write, which is what
 * the record's `superRefine` demands and what the reducer's `judged` case
 * makes possible: the answer is in state before `status` leaves "playing", so
 * this function — called SYNCHRONOUSLY from the lifecycle's completion effect
 * — always has it.
 *
 * `outcome` is DERIVED from `state.status` rather than read off a second
 * field, because there is no second field: `TermoPlayState` carries no
 * `outcome` (ADR-0029 consequence (e)). `solved → "won"` is the reducer's own
 * `won → solved` mapping read backwards, and it needs no engine call.
 *
 * `hintsUsed` is the literal 0. Termo ships no hint (ADR-0045 decision 1),
 * and the record's `.max(1)` stays because one free hint per puzzle is a
 * PRODUCT rule rather than a per-game one.
 *
 * `closed` rather than `solved`: the lifecycle's terminal predicate is "the
 * game is CLOSED", and Termo is the first game for which the two differ.
 */
function buildRecord(
  state: TermoPlayState,
  now: number,
  closed: boolean,
): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: state.date,
    guesses: state.guesses.map((row) => ({
      guess: row.guess,
      tiles: [...row.tiles],
    })),
    answer: closed ? state.answer : undefined,
    outcome: closed ? (state.status === "solved" ? "won" : "lost") : undefined,
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: 0,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
