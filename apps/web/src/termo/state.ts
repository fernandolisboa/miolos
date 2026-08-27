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

const copy = messages.games.termo.play;

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
        return noticed(state, copy.notInList);
      }

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
        draft: state.pending,
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

function noticed(state: TermoPlayState, notice: string): TermoPlayState {
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
