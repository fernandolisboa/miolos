import {
  deriveBoardStatus,
  isProfanityForm,
  isValidGuess,
  MAX_GUESSES,
  WORD_LENGTH,
} from "@miolos/games/termo";

import { messages } from "../i18n";
import { freshCore, hydratedAt, restoredFrom, timed } from "../play/play-core";
import type { PlayRecord } from "../play/play-record";
import { typedLetter } from "../play/typed-letter";
import type { TermoJudgedRow, TermoPlayAction, TermoPlayState } from "./types";

const copy = messages.games.termo.play;

export const EMPTY_DRAFT: readonly string[] = Array.from(
  { length: WORD_LENGTH },
  () => "",
);

export function initTermoPlayState(date: string): TermoPlayState {
  return {
    ...freshCore(date),
    guesses: [],
    draft: EMPTY_DRAFT,
    cursor: 0,
    pending: null,
    notice: null,
    noticeNonce: 0,
    held: false,
    announcement: "",
    answer: undefined,
    gone: false,
  };
}

export type TermoPlayReducer = (
  state: TermoPlayState,
  action: TermoPlayAction,
) => TermoPlayState;

export function termoPlayReducer(
  state: TermoPlayState,
  action: TermoPlayAction,
): TermoPlayState {
  return reduceTermoPlay(state, action, isWordOrProfanityDeferredToServer);
}

export function freeTermoPlayReducer(
  state: TermoPlayState,
  action: TermoPlayAction,
): TermoPlayState {
  return reduceTermoPlay(state, action, isValidGuess);
}

function isWordOrProfanityDeferredToServer(word: string): boolean {
  return isValidGuess(word) || isProfanityForm(word);
}

function reduceTermoPlay(
  state: TermoPlayState,
  action: TermoPlayAction,
  locallyAccepted: (word: string) => boolean,
): TermoPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "tick":
    case "pause":
    case "resume":
      return timed(state, action);

    case "type":
    case "erase":
    case "select":
      return accepting(state) ? editDraft(state, action) : state;

    case "submit": {
      const word = submittedWord(state.draft);
      if (!accepting(state) || word === null) {
        return state;
      }
      if (!locallyAccepted(word)) {
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
  if (record?.game !== "termo") {
    return hydratedAt(state, now);
  }
  const derived = deriveBoardStatus(record.guesses.map((row) => row.tiles));
  if ((record.outcome ?? "playing") !== derived) {
    return hydratedAt(state, now);
  }
  return {
    ...restoredFrom(state, record, now),
    guesses: record.guesses,
    answer: record.answer,
    status: playStatus(derived),
  };
}
