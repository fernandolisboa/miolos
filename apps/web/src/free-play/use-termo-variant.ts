"use client";

import {
  deriveKeyboardState,
  isValidGuess,
  judgeBoards,
  type JudgedBoards,
  type KeyboardState,
} from "@miolos/games/termo";
import { useCallback, useEffect, useMemo, useReducer } from "react";

import { messages } from "../i18n";
import {
  editDraft,
  EMPTY_DRAFT,
  noticed,
  submittedWord,
  type TermoDraft,
  type TermoDraftAction,
} from "../termo/state";

const copy = messages.games.termo.play;
const variantCopy = messages.freePlay.variant;

export interface TermoVariantState extends TermoDraft {
  readonly answers: readonly string[];
  readonly maxGuesses: number;
  readonly guesses: readonly string[];
  readonly judged: JudgedBoards;
  readonly pending: string | null;
  readonly notice: string | null;
  readonly noticeNonce: number;
}

export type TermoVariantAction =
  TermoDraftAction | { readonly type: "submit" } | { readonly type: "judged" };

export function initTermoVariant(
  answers: readonly string[],
  maxGuesses: number,
): TermoVariantState {
  return {
    answers,
    maxGuesses,
    guesses: [],
    judged: judgeBoards([], answers, maxGuesses),
    pending: null,
    draft: EMPTY_DRAFT,
    cursor: 0,
    announcement: "",
    notice: null,
    noticeNonce: 0,
  };
}

export function termoVariantReducer(
  state: TermoVariantState,
  action: TermoVariantAction,
): TermoVariantState {
  if (state.judged.status !== "playing") {
    return state;
  }
  if (action.type === "judged") {
    return state.pending === null ? state : judgedPending(state, state.pending);
  }
  if (state.pending !== null) {
    return state;
  }
  if (action.type !== "submit") {
    return editDraft(state, action);
  }
  const word = submittedWord(state.draft);
  if (word === null) {
    return state;
  }
  if (!isValidGuess(word, false)) {
    return noticed(state, copy.notInList);
  }
  return {
    ...state,
    pending: word,
    draft: EMPTY_DRAFT,
    cursor: 0,
    notice: null,
    noticeNonce: state.noticeNonce + 1,
  };
}

function judgedPending(
  state: TermoVariantState,
  word: string,
): TermoVariantState {
  const guesses = [...state.guesses, word];
  const judged = judgeBoards(guesses, state.answers, state.maxGuesses);
  return {
    ...state,
    guesses,
    judged,
    pending: null,
    announcement: guessAria(
      state.judged,
      judged,
      guesses.length,
      state.maxGuesses,
    ),
  };
}

function guessAria(
  before: JudgedBoards,
  after: JudgedBoards,
  row: number,
  maxGuesses: number,
): string {
  return after.boards
    .flatMap((board, index) => {
      const judged = board.rows[row - 1];
      if (before.boards[index]?.status !== "playing" || judged === undefined) {
        return [];
      }
      const found =
        board.status === "won" ? `, ${variantCopy.foundAria(index + 1)}` : "";
      return [
        `${variantCopy.boardAria(index + 1, after.boards.length)}, ${copy.rowAria(row, maxGuesses, judged.guess, judged.tiles)}${found}`,
      ];
    })
    .join(". ");
}

export function useTermoVariant(
  answers: readonly string[],
  maxGuesses: number,
) {
  const [state, dispatch] = useReducer(termoVariantReducer, null, () =>
    initTermoVariant(answers, maxGuesses),
  );
  const { judged, pending } = state;
  useEffect(() => {
    if (pending !== null) {
      dispatch({ type: "judged" });
    }
  }, [pending]);
  const keyboardStates = useMemo(
    (): readonly (KeyboardState | null)[] =>
      judged.boards.map((board) =>
        board.status === "won" ? null : deriveKeyboardState(board.rows),
      ),
    [judged],
  );

  const type = useCallback((letter: string) => {
    dispatch({ type: "type", letter });
  }, []);
  const erase = useCallback(() => {
    dispatch({ type: "erase" });
  }, []);
  const select = useCallback((slot: number) => {
    dispatch({ type: "select", slot });
  }, []);
  const submit = useCallback(() => {
    dispatch({ type: "submit" });
  }, []);

  return {
    state,
    judged,
    keyboardStates,
    type,
    erase,
    select,
    submit,
  };
}
