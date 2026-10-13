import {
  HINTS_PER_PUZZLE_CEILING,
  type DailySudokuResponse,
} from "@miolos/core";
import {
  getSudokuConflicts,
  isSudokuSolved,
  type SudokuGrid,
  type SudokuTier,
} from "@miolos/games/sudoku";

import { movedSelection } from "../play/grid-selection";
import { hasHintLeft } from "../play/hint-allowance";
import { idleHint, spentHint, unlit } from "../play/hint-state";
import type { PlayRecord, SudokuPlayRecord } from "../play/play-record";
import { resetBoard, type ResetAction } from "../play/reset-board";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import { mergedGrid } from "./engine";
import { nextSudokuHint, type SudokuHintReason } from "./hint";

const SIDE = 9;

export type SudokuDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SudokuCellValue = SudokuDigit | null;

export interface SudokuPlayState extends PlayCore {
  readonly givens: SudokuGrid;

  readonly entries: readonly SudokuCellValue[];

  readonly selected: number | null;

  readonly tier: SudokuTier;
  readonly hint: HintState<SudokuHintReason>;

  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

export type SudokuPlayAction =
  | LifecycleAction
  | ResetAction
  | { readonly type: "select"; readonly index: number }
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "enter-digit"; readonly digit: SudokuDigit }
  | { readonly type: "clear-cell" }
  | { readonly type: "use-hint"; readonly solution: readonly SudokuDigit[] }
  | { readonly type: "mark-synced" };

export function initSudokuPlayState(
  daily: DailySudokuResponse,
): SudokuPlayState {
  const givens: SudokuGrid = daily.givens;
  const entries: readonly SudokuCellValue[] = givens.map(() => null);
  const derived = derive(givens, entries);
  return {
    date: daily.date,
    givens,
    entries: derived.entries,
    selected: null,
    tier: daily.tier,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    violating: derived.violating,
    status: derived.status,
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function sudokuPlayReducer(
  state: SudokuPlayState,
  action: SudokuPlayAction,
): SudokuPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "select":
      return state.selected === action.index
        ? state
        : { ...unlit(state), selected: action.index };

    case "move-selection":
      return {
        ...unlit(state),
        selected: movedSelection(state.selected, action, SIDE),
      };

    case "enter-digit": {
      const current = playableValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return unlit(state);
      }

      return withEntry(
        unlit(state),
        state.selected,
        current === action.digit ? null : action.digit,
      );
    }

    case "clear-cell": {
      const current = playableValue(state, state.selected);
      if (
        current === null ||
        current === undefined ||
        state.selected === null
      ) {
        return unlit(state);
      }
      return withEntry(unlit(state), state.selected, null);
    }

    case "use-hint": {
      if (!canHint(state, HINTS_PER_PUZZLE_CEILING)) {
        return state;
      }
      const hint = nextSudokuHint(action.solution, state.givens, state.entries);
      if (hint === null) {
        return state;
      }

      const revealed = withEntry(state, hint.index, hint.value);
      return {
        ...revealed,
        hint: spentHint(state.hint, hint),
      };
    }

    case "reset":
      return resetBoard(state, (entries) => ({
        ...state,
        ...derive(state.givens, entries),
      }));

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

function playableValue(
  state: SudokuPlayState,
  index: number | null,
): SudokuCellValue | undefined {
  if (index === null) {
    return undefined;
  }
  const given = state.givens[index];
  if (given === undefined || given !== 0) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

interface DerivedEntries {
  readonly entries: readonly SudokuCellValue[];
  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

function derive(
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): DerivedEntries {
  const merged = mergedGrid(givens, entries);
  return {
    entries,
    violating: new Set(getSudokuConflicts(merged)),
    status: isSudokuSolved(merged) ? "solved" : "playing",
  };
}

function withEntry(
  state: SudokuPlayState,
  index: number,
  value: SudokuCellValue,
): SudokuPlayState {
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const derived = derive(state.givens, entries);
  return {
    ...state,
    ...derived,
    pendingSync:
      derived.status === "solved" && state.status !== "solved"
        ? true
        : state.pendingSync,
  };
}

function restore(
  state: SudokuPlayState,
  record: PlayRecord | undefined,
  now: number,
): SudokuPlayState {
  if (!isSudokuRecord(record)) {
    return { ...state, now, hydrated: true };
  }
  const derived = derive(state.givens, record.entries);
  return {
    ...state,
    ...derived,
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: idleHint(record.hintsUsed),
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

function isSudokuRecord(
  record: PlayRecord | undefined,
): record is SudokuPlayRecord {
  return record?.game === "sudoku";
}

export function canHint(state: SudokuPlayState, limit: number | null): boolean {
  return hasHintLeft(state.hint.used, limit) && state.status === "playing";
}
