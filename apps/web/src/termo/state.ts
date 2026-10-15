import {
  deriveBoardStatus,
  isValidGuess,
  MAX_GUESSES,
  WORD_LENGTH,
} from "@miolos/games/termo";

import { messages } from "../i18n";
import type { PlayRecord, TermoPlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import { typedLetter } from "../play/typed-letter";
import type { TermoJudgedRow, TermoPlayAction, TermoPlayState } from "./types";

const copy = messages.games.termo.play;

export const EMPTY_DRAFT: readonly string[] = Array.from(
  { length: WORD_LENGTH },
  () => "",
);

export function initTermoPlayState(date: string): TermoPlayState {
  return {
    date,
    guesses: [],
    draft: EMPTY_DRAFT,
    cursor: 0,
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
    gone: false,
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

    case "type":
    case "erase":
    case "select":
      return accepting(state) ? editDraft(state, action) : state;

    case "submit": {
      const word = submittedWord(state.draft);
      if (!accepting(state) || word === null) {
        return state;
      }
      if (!isValidGuess(word)) {
        return noticed(state, copy.notInList);
      }

      return {
        ...state,
        draft: EMPTY_DRAFT,
        cursor: 0,
        pending: word,
        held: false,
        notice: null,
        noticeNonce: state.noticeNonce + 1,
      };
    }

    case "retry": {
      if (!state.held || state.pending === null) {
        return state;
      }

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

      return {
        ...noticed(
          state,
          { offline: copy.offline, server: copy.failed }[action.reason],
        ),
        held: true,
      };
    }

    case "gone":
      return { ...state, gone: true };

    case "rejected": {
      if (state.pending === null) {
        return state;
      }

      return {
        ...noticed(
          state,
          {
            "not-in-list": copy.notInList,
            refused: copy.failed,
          }[action.reason],
        ),
        draft: [...state.pending],
        cursor: WORD_LENGTH - 1,
        pending: null,
        held: false,
      };
    }

    case "judged": {
      if (state.pending === null) {
        return state;
      }

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

function accepting(state: TermoPlayState): boolean {
  return state.status === "playing" && state.pending === null;
}

export interface TermoDraft {
  readonly draft: readonly string[];
  readonly cursor: number;
  readonly announcement: string;
}

export type TermoDraftAction = Extract<
  TermoPlayAction,
  { readonly type: "type" | "erase" | "select" }
>;

export function editDraft<S extends TermoDraft>(
  state: S,
  action: TermoDraftAction,
): S {
  switch (action.type) {
    case "type": {
      const letter = typedLetter(action.letter);
      if (letter === null) {
        return state;
      }
      const draft = withSlot(state.draft, state.cursor, letter);
      return {
        ...state,
        draft,
        cursor: nextCursor(draft, state.cursor),
        announcement: copy.letterTypedAria(
          letter,
          state.cursor + 1,
          WORD_LENGTH,
        ),
      };
    }

    case "erase": {
      const slot =
        state.draft[state.cursor] === "" ? state.cursor - 1 : state.cursor;
      const erased = state.draft[slot];
      if (erased === undefined) {
        return state;
      }
      if (erased === "") {
        return { ...state, cursor: slot };
      }
      return {
        ...state,
        draft: withSlot(state.draft, slot, ""),
        cursor: slot,
        announcement: copy.letterErasedAria(erased, slot + 1, WORD_LENGTH),
      };
    }

    case "select":
      return action.slot === state.cursor ||
        state.draft[action.slot] === undefined
        ? state
        : { ...state, cursor: action.slot };
  }
}

export function submittedWord(draft: readonly string[]): string | null {
  const word = draft.join("");
  return word.length === WORD_LENGTH ? word : null;
}

function withSlot(
  draft: readonly string[],
  slot: number,
  letter: string,
): readonly string[] {
  return draft.map((current, index) => (index === slot ? letter : current));
}

function nextCursor(draft: readonly string[], from: number): number {
  for (let step = 1; step < WORD_LENGTH; step += 1) {
    const slot = (from + step) % WORD_LENGTH;
    if (draft[slot] === "") {
      return slot;
    }
  }
  return Math.min(from + 1, WORD_LENGTH - 1);
}

export function noticed<
  S extends { readonly notice: string | null; readonly noticeNonce: number },
>(state: S, notice: string): S {
  return { ...state, notice, noticeNonce: state.noticeNonce + 1 };
}

function playStatus(
  status: "playing" | "won" | "lost",
): TermoPlayState["status"] {
  return status === "won" ? "solved" : status;
}

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

function isTermoRecord(
  record: PlayRecord | undefined,
): record is TermoPlayRecord {
  return record?.game === "termo";
}
