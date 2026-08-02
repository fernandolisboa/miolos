/**
 * The whole Termo gameplay state machine (#27, plan 022 §14.4), as one pure
 * reducer over one immutable value: no React, no DOM, no clock. Every action
 * that needs the time carries it, so the reducer stays pure and the screen
 * stays thin.
 *
 * Termo is the first game whose board is READ-ONLY OUTPUT (ADR-0042): there is
 * no caret, no cell to select and no brush. The whole input surface is a
 * five-letter draft, a submit and an erase, which is why this state carries
 * strings where the three grid games carry arrays.
 *
 * It is also the first whose verdict comes from the SERVER (ADR-0038). The
 * engine is used here for exactly three things — normalizing a keystroke,
 * checking the local word list, and deriving a restored board's status — and
 * never to judge a live guess.
 */
import type { DailyTermoResponse } from "@miolos/core";
import {
  deriveBoardStatus,
  isValidGuess,
  normalizeWord,
  MAX_GUESSES,
  WORD_LENGTH,
} from "@miolos/games/termo";

import { messages } from "../i18n";
import type { PlayRecord, TermoPlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { TermoJudgedRow, TermoPlayAction, TermoPlayState } from "./types";

/**
 * The copy the reducer writes into its two live regions. Read from the
 * module rather than threaded through the actions: every string a player
 * hears is composed in `messages.ts` (ADR-0018), and composing them in the
 * hook instead would need the POST-transition letter count the hook does not
 * have.
 */
const copy = messages.games.termo.play;

/** One letter, after `normalizeWord`. `ç` is `c` and `á` is `a` (AC 2). */
const SINGLE_LETTER = /^[a-z]$/;

export function initTermoPlayState(daily: DailyTermoResponse): TermoPlayState {
  return {
    date: daily.date,
    guesses: [],
    draft: "",
    pending: null,
    notice: null,
    noticeNonce: 0,
    held: false,
    announcement: "",
    answer: undefined,
    timer: { accumulatedMs: 0, runningSince: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function termoPlayReducer(
  state: TermoPlayState,
  action: TermoPlayAction,
): TermoPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "tick":
    case "pause":
    case "resume":
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };

    case "type": {
      const letter = normalizeWord(action.letter);
      if (
        !accepting(state) ||
        state.draft.length >= WORD_LENGTH ||
        !SINGLE_LETTER.test(letter)
      ) {
        return state;
      }
      const draft = state.draft + letter;
      return {
        ...state,
        draft,
        announcement: copy.letterTypedAria(letter, draft.length, WORD_LENGTH),
      };
    }

    case "erase": {
      if (!accepting(state) || state.draft === "") {
        return state;
      }
      const erased = state.draft.slice(-1);
      const draft = state.draft.slice(0, -1);
      return {
        ...state,
        draft,
        announcement: copy.letterErasedAria(erased, draft.length, WORD_LENGTH),
      };
    }

    case "submit": {
      if (!accepting(state) || state.draft.length !== WORD_LENGTH) {
        return state;
      }
      if (!isValidGuess(state.draft)) {
        // The LOCAL half of AC 3. The draft stays in the row — a rejection
        // sits under the board for exactly as long as the player is fixing
        // the word — and the turn is not spent.
        return noticed(state, copy.notInList);
      }
      // The draft moves into the pending row and the notice is CLEARED here,
      // never on `judged` and never on the next keystroke: those are the two
      // placements that look natural and both collide with the announcer
      // (plan 022 §13.1b).
      return {
        ...state,
        draft: "",
        pending: state.draft,
        held: false,
        notice: null,
        noticeNonce: state.noticeNonce + 1,
      };
    }

    case "retry": {
      if (!state.held || state.pending === null) {
        return state;
      }
      // The clear rides HERE and not on the `judged` that follows a
      // successful retry, which is the one transition where the naive
      // placement would write both live regions in the same commit.
      return {
        ...state,
        held: false,
        notice: null,
        noticeNonce: state.noticeNonce + 1,
      };
    }

    case "held": {
      if (state.pending === null) {
        return state;
      }
      return { ...noticed(state, copy.offline), held: true };
    }

    case "rejected": {
      if (state.pending === null) {
        return state;
      }
      // The turn is NOT consumed — the server judged the WORD, not the board
      // — so the guess returns to the row it came from. A 422 `invalid-guess`
      // renders the same sentence a local rejection does, and the same
      // sentence has to leave the same screen (plan 022 §11.4, §13.1b).
      return {
        ...noticed(
          state,
          {
            "not-in-list": copy.notInList,
            refused: copy.failed,
          }[action.reason],
        ),
        draft: state.pending,
        pending: null,
        held: false,
      };
    }

    case "judged": {
      if (state.pending === null) {
        return state;
      }
      // THE ORDERING CONTRACT, and it is the sharpest correctness constraint
      // in the client half. `use-play-lifecycle.ts` fires the completion
      // effect on `closedAndFrozen` and calls `buildRecord(state, Date.now(),
      // true)` SYNCHRONOUSLY. So `status` must not leave "playing" until the
      // closing judge response has been fully absorbed — this one action
      // writes `guesses`, `answer` and `status` in a SINGLE transition, and
      // there is no reachable state in which `status` is terminal and
      // `answer` is undefined. If that ordering broke, `buildRecord` would
      // write a record with no `answer`, the record's `superRefine` would
      // refuse it, `writePlayRecord` would drop it, and THE COMPLETION WOULD
      // BE LOST. Pinned by T-WEB-S82.
      //
      // This is also the ONE place the `won → solved` mapping is written, and
      // it is written nowhere else in the repo. The engine and the wire speak
      // "playing" | "won" | "lost"; `PlayCore.status` is
      // "playing" | "solved" | "lost" and has no "won" member at all
      // (ADR-0044 decision 3). `buildRecord`'s `state.status === "solved" ?
      // "won" : "lost"` is that same mapping read backwards, not a second
      // copy of it.
      //
      // `notice` is deliberately untouched: `submit` and `retry` are the only
      // clears, so by the time a verdict lands the line is already empty.
      const status = playStatus(action.status);
      const guesses: readonly TermoJudgedRow[] = [
        ...state.guesses,
        { guess: action.guess, tiles: action.tiles },
      ];
      return {
        ...state,
        guesses,
        answer: action.answer,
        status,
        pending: null,
        held: false,
        pendingSync: status === "playing" ? state.pendingSync : true,
        announcement: copy.rowAria(
          guesses.length,
          MAX_GUESSES,
          action.guess,
          action.tiles,
        ),
      };
    }
  }
}

/** The board takes input only while it is open and nothing is in flight. */
function accepting(state: TermoPlayState): boolean {
  return state.status === "playing" && state.pending === null;
}

/**
 * Write the notice and bump the nonce — including when the string is the one
 * already there, which is the whole point: `role="status"` is aria-atomic and
 * React leaves a text node it rewrites identically alone, so a second
 * identical rejection would be silent on the one channel telling the player
 * why the board is not moving.
 */
function noticed(state: TermoPlayState, notice: string): TermoPlayState {
  return { ...state, notice, noticeNonce: state.noticeNonce + 1 };
}

/**
 * The engine's board status, in the lifecycle's vocabulary. `won → solved`,
 * everything else through unchanged. See the `judged` case: this is the one
 * definition, and `buildRecord` reads it backwards.
 */
function playStatus(
  status: "playing" | "won" | "lost",
): TermoPlayState["status"] {
  return status === "won" ? "solved" : status;
}

/**
 * Map a persisted record onto the state. `runningSince` stays null: the mount
 * effect derives the initial running state from `document.visibilityState`
 * and dispatches `resume` itself, rather than resuming a tab the player
 * cannot see.
 *
 * A record whose stored `outcome` DISAGREES with `deriveBoardStatus(tiles)`
 * is DISCARDED, never migrated — the same way `nonogram/state.ts` discards a
 * size mismatch, and for a sharper reason. `outcome` is stored on the record
 * because `day-state.ts` reads it and must never import a game engine
 * (ADR-0044 decision 3), so THIS is the single place the derivation is
 * checked at all. A hand-edited `{concluded: true, outcome: "won"}` over six
 * losing rows would otherwise restore a solved board.
 *
 * `record.outcome ?? "playing"` is the whole comparison: the record's
 * `superRefine` already ties `outcome !== undefined` to `concluded`, so an
 * absent outcome means exactly "still playing", which is what
 * `deriveBoardStatus` returns for the same rows.
 *
 * `deriveBoardStatus` THROWS for more than MAX_GUESSES rows and for a row
 * following an all-correct one. Neither can reach here: the record schema
 * refuses both shapes, and `readPlayRecord` parses before this is called.
 */
function restore(
  state: TermoPlayState,
  record: PlayRecord | undefined,
  now: number,
): TermoPlayState {
  if (!isTermoRecord(record)) {
    return { ...state, now, hydrated: true };
  }
  const derived = deriveBoardStatus(record.guesses.map((row) => row.tiles));
  if ((record.outcome ?? "playing") !== derived) {
    return { ...state, now, hydrated: true };
  }
  return {
    ...state,
    guesses: record.guesses,
    answer: record.answer,
    status: playStatus(derived),
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

/**
 * The record union's termo member, or nothing. `readPlayRecord` already
 * discards a record that does not address the key it was found under — `game`
 * and `date` both — so this branch is unreachable in practice: it exists
 * because the reducer takes the whole union and a 64-cell binairo `entries`
 * array must never reach a Termo board.
 */
function isTermoRecord(
  record: PlayRecord | undefined,
): record is TermoPlayRecord {
  return record?.game === "termo";
}
