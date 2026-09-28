import type { DailyCrosswordResponse } from "@miolos/core";

import { nextHint } from "../play/grid-hint";
import type { CrosswordPlayRecord, PlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import {
  colOf,
  entryAt,
  flattenGrid,
  GRID_SIZE,
  hintGivens,
  indexOf,
  isBlock,
  isSolved,
  nextCellInEntry,
  prevCellInEntry,
  rowOf,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";

export type { CrosswordDirection } from "./grid";

export type CrosswordCellValue = string | null;

export interface CrosswordPlayState extends PlayCore {
  readonly solution: readonly CrosswordCellValue[];
  readonly clues: readonly CrosswordClue[];

  readonly entries: readonly CrosswordCellValue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly hint: HintState;

  readonly status: "playing" | "solved";
}

export type CrosswordPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  | {
      readonly type: "select-entry";
      readonly index: number;
      readonly direction: CrosswordDirection;
    }
  | { readonly type: "toggle-direction" }
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "type-letter"; readonly letter: string }
  | { readonly type: "backspace" }
  | { readonly type: "use-hint" }
  | { readonly type: "mark-synced" };

export function initCrosswordPlayState(
  daily: DailyCrosswordResponse,
): CrosswordPlayState {
  const solution = flattenGrid(daily.grid);
  const entries: readonly CrosswordCellValue[] = solution.map(() => null);
  return {
    date: daily.date,
    solution,
    clues: daily.clues,
    entries,
    selected: null,
    direction: "across",
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function crosswordPlayReducer(
  state: CrosswordPlayState,
  action: CrosswordPlayAction,
): CrosswordPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "select":
      return state.selected === action.index
        ? state
        : { ...state, selected: action.index };

    case "select-entry":
      return { ...state, selected: action.index, direction: action.direction };

    case "toggle-direction": {
      if (state.selected === null) {
        return state;
      }
      const other = state.direction === "across" ? "down" : "across";
      return entryAt(state.clues, state.selected, other) === undefined
        ? state
        : { ...state, direction: other };
    }

    case "move-selection":
      return { ...state, selected: moved(state.selected, action) };

    case "type-letter": {
      if (state.selected === null || isBlock(state.solution, state.selected)) {
        return state;
      }
      const entered = withEntry(state, state.selected, action.letter);
      const clue = entryAt(state.clues, state.selected, state.direction);
      const next =
        clue === undefined ? undefined : nextCellInEntry(clue, state.selected);
      return next === undefined ? entered : { ...entered, selected: next };
    }

    case "backspace": {
      if (state.selected === null || isBlock(state.solution, state.selected)) {
        return state;
      }
      if (state.entries[state.selected] !== null) {
        return withEntry(state, state.selected, null);
      }
      const clue = entryAt(state.clues, state.selected, state.direction);
      const prev =
        clue === undefined ? undefined : prevCellInEntry(clue, state.selected);
      return prev === undefined
        ? state
        : withEntry({ ...state, selected: prev }, prev, null);
    }

    case "use-hint": {
      if (state.hint.used >= state.hint.free || state.status === "solved") {
        return state;
      }
      const hint = nextHint(
        state.solution,
        hintGivens(state.solution),
        state.entries,
      );
      if (hint === null) {
        return state;
      }
      const revealed = withEntry(state, hint.index, hint.value);
      return {
        ...revealed,
        hint: { free: 1, used: state.hint.used + 1, lastIndex: hint.index },
      };
    }

    case "tick":
    case "pause":
    case "resume":
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };

    case "mark-synced":
      return state.pendingSync ? { ...state, pendingSync: false } : state;
  }
}

function moved(
  selected: number | null,
  move: { readonly rows: number; readonly columns: number },
): number {
  if (selected === null) {
    return 0;
  }
  const row = clamp(rowOf(selected) + move.rows);
  const column = clamp(colOf(selected) + move.columns);
  return indexOf(row, column);
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), GRID_SIZE - 1);
}

function withEntry(
  state: CrosswordPlayState,
  index: number,
  value: CrosswordCellValue,
): CrosswordPlayState {
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const solved = isSolved(state.solution, entries);
  return {
    ...state,
    entries,
    status: solved ? "solved" : "playing",
    pendingSync: solved && state.status !== "solved" ? true : state.pendingSync,
  };
}

function restore(
  state: CrosswordPlayState,
  record: PlayRecord | undefined,
  now: number,
): CrosswordPlayState {
  if (!isCrosswordRecord(record)) {
    return { ...state, now, hydrated: true };
  }
  return {
    ...state,
    entries: record.entries,
    status: isSolved(state.solution, record.entries) ? "solved" : "playing",
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

function isCrosswordRecord(
  record: PlayRecord | undefined,
): record is CrosswordPlayRecord {
  return record?.game === "crossword";
}
