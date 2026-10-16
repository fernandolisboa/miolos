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
import { NO_HISTORY, undoable, type UndoHistory } from "../play/undo";
import { mergedGrid } from "./engine";
import { nextSudokuHint, type SudokuHintReason } from "./hint";
import {
  clearNotes,
  hasNote,
  NO_NOTES,
  toggleNote,
  withoutPeerNote,
} from "./notes";

const SIDE = 9;

export type SudokuDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SudokuCellValue = SudokuDigit | null;

export interface SudokuPlayState extends PlayCore {
  readonly givens: SudokuGrid;

  readonly entries: readonly SudokuCellValue[];

  readonly notes: readonly number[];

  readonly selected: number | null;

  readonly locked: SudokuDigit | null;

  readonly noting: boolean;

  readonly tier: SudokuTier;
  readonly hint: HintState<SudokuHintReason>;

  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
  readonly history: UndoHistory<SudokuSnapshot>;
}

type SudokuSnapshot = Pick<
  SudokuPlayState,
  "entries" | "notes" | "violating" | "selected" | "hint"
>;

export interface DigitLockUndo {
  readonly index: number;
  readonly value: SudokuCellValue;
  readonly notes: readonly number[];
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
  | {
      readonly type: "enter-digit";
      readonly digit: SudokuDigit;
      readonly cleanNotes: boolean;
    }
  | { readonly type: "toggle-note"; readonly digit: SudokuDigit }
  | { readonly type: "toggle-noting" }
  | { readonly type: "clear-cell" }
  | {
      readonly type: "lock-digit";
      readonly digit: SudokuDigit;
      readonly undo: DigitLockUndo | null;
    }
  | { readonly type: "unlock" }
  | {
      readonly type: "tap-cell";
      readonly index: number;
      readonly cleanNotes: boolean;
    }
  | {
      readonly type: "use-hint";
      readonly solution: readonly SudokuDigit[];
      readonly cleanNotes: boolean;
    }
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
    notes: NO_NOTES,
    selected: null,
    locked: null,
    noting: false,
    tier: daily.tier,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    violating: derived.violating,
    status: derived.status,
    pendingSync: false,
    now: 0,
    hydrated: false,
    history: NO_HISTORY,
  };
}

export const sudokuPlayReducer = undoable(
  playSudoku,
  ({ entries, notes, violating, selected, hint }): SudokuSnapshot => ({
    entries,
    notes,
    violating,
    selected,
    hint,
  }),
  ({ entries, notes }) => [entries, notes],
);

function playSudoku(
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

      return state.noting
        ? noted(unlit(state), action.digit)
        : withEntry(
            unlit(state),
            state.selected,
            current === action.digit ? null : action.digit,
            action.cleanNotes,
          );
    }

    case "toggle-note":
      return noted(unlit(state), action.digit);

    case "toggle-noting":
      return { ...state, noting: !state.noting, locked: null };

    case "clear-cell": {
      const current = playableValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return unlit(state);
      }
      return current === null
        ? { ...unlit(state), notes: clearNotes(state.notes, state.selected) }
        : withEntry(unlit(state), state.selected, null, false);
    }

    case "lock-digit": {
      if (state.status !== "playing" || state.noting) {
        return state;
      }
      const { undo } = action;
      const restored =
        undo === null || playableValue(state, undo.index) === undefined
          ? state
          : {
              ...withEntry(state, undo.index, undo.value, false),
              notes: undo.notes,
            };
      return { ...restored, locked: action.digit };
    }

    case "unlock":
      return state.locked === null ? state : { ...state, locked: null };

    case "tap-cell": {
      if (state.status !== "playing" || state.locked === null) {
        return state;
      }
      const tapped = unlit({ ...state, selected: action.index });
      const current = playableValue(state, action.index);
      return current === undefined
        ? tapped
        : withEntry(
            tapped,
            action.index,
            current === state.locked ? null : state.locked,
            action.cleanNotes,
          );
    }

    case "use-hint": {
      if (!canHint(state, HINTS_PER_PUZZLE_CEILING)) {
        return state;
      }
      const hint = nextSudokuHint(action.solution, state.givens, state.entries);
      if (hint === null) {
        return state;
      }

      const revealed = withEntry(
        state,
        hint.index,
        hint.value,
        action.cleanNotes,
      );
      return {
        ...revealed,
        hint: spentHint(state.hint, hint),
      };
    }

    case "reset": {
      const unnoted = hasNote(state.notes)
        ? { ...state, notes: NO_NOTES }
        : state;
      return resetBoard(unnoted, (entries) => ({
        ...unnoted,
        ...derive(state.givens, entries),
      }));
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

function noted(state: SudokuPlayState, digit: SudokuDigit): SudokuPlayState {
  const { selected } = state;
  return selected === null || playableValue(state, selected) !== null
    ? state
    : { ...state, notes: toggleNote(state.notes, selected, digit) };
}

function withEntry(
  state: SudokuPlayState,
  index: number,
  value: SudokuCellValue,
  cleanNotes: boolean,
): SudokuPlayState {
  if (state.status !== "playing") {
    return state;
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const derived = derive(state.givens, entries);
  const own = clearNotes(state.notes, index);
  return {
    ...state,
    ...derived,
    notes:
      value !== null && cleanNotes ? withoutPeerNote(own, index, value) : own,
    pendingSync: derived.status === "solved" ? true : state.pendingSync,
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
  const notes = (record.notes ?? NO_NOTES).map((mask, index) =>
    state.givens[index] !== 0 || record.entries[index] !== null ? 0 : mask,
  );
  return {
    ...state,
    ...derived,
    notes,
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
