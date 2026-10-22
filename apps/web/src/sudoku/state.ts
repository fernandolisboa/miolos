import {
  HINTS_PER_PUZZLE_CEILING,
  type DailySudokuResponse,
} from "@miolos/core";
import {
  CLASSIC_LAYOUT,
  getSudokuConflicts,
  isSudokuSolved,
  type SudokuGrid,
  type SudokuLayout,
  type SudokuTier,
} from "@miolos/games/sudoku";

import { movedSelection } from "../play/grid-selection";
import {
  NO_MISTAKES,
  type CellPress,
  type MistakeRules,
  type MistakeState,
} from "../play/mistakes";
import { hintAllowed } from "../play/hint-allowance";
import { idleHint, spentHint, unlit } from "../play/hint-state";
import type { PlayRecord } from "../play/play-record";
import { freshCore, hydratedAt, restoredFrom, timed } from "../play/play-core";
import { resetBoard, type ResetAction } from "../play/reset-board";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import {
  NO_HISTORY,
  undoable,
  type UndoAction,
  type UndoHistory,
} from "../play/undo";
import { asDigit, mergedGrid, playableGivens } from "./engine";
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

  readonly layout: SudokuLayout;

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
  readonly mistakes: MistakeState;
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
      readonly pointer?: true;
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
    };

export function initSudokuPlayState(
  daily: DailySudokuResponse,
  layout: SudokuLayout = CLASSIC_LAYOUT,
): SudokuPlayState {
  const givens: SudokuGrid = daily.givens;
  const entries: readonly SudokuCellValue[] = givens.map(() => null);
  const derived = derive(givens, layout, entries);
  return {
    ...freshCore(daily.date),
    givens,
    layout,
    entries: derived.entries,
    notes: NO_NOTES,
    selected: null,
    locked: null,
    noting: false,
    tier: daily.tier,
    hint: idleHint(0),
    violating: derived.violating,
    status: derived.status,
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
  };
}

export function sudokuMistakes(
  solution: readonly SudokuDigit[] | null,
  givens: SudokuGrid,
): MistakeRules<SudokuPlayState, SudokuPlayAction | UndoAction> {
  const judged =
    solution === null ? null : { solution, givens: playableGivens(givens) };
  return { judge: () => judged, press: sudokuPress };
}

function sudokuPress(
  { selected }: SudokuPlayState,
  action: SudokuPlayAction | UndoAction,
): CellPress | null {
  switch (action.type) {
    case "enter-digit":
    case "clear-cell":
      return selected === null
        ? null
        : {
            index: selected,
            held: action.type === "enter-digit" && action.pointer === true,
          };
    case "tap-cell":
      return { index: action.index, held: true };
    case "lock-digit":
      return action.undo === null
        ? null
        : { index: action.undo.index, held: true };
    default:
      return null;
  }
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
      return { ...state, noting: !state.noting };

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
      if (state.status !== "playing") {
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
      const switched = switchedLock(state, action.index);
      if (switched !== null) {
        return { ...tapped, locked: switched };
      }
      if (state.noting) {
        return noted(tapped, state.locked);
      }
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
      if (!hintAllowed(state, HINTS_PER_PUZZLE_CEILING)) {
        return state;
      }
      const hint = nextSudokuHint(
        action.solution,
        state.givens,
        state.entries,
        state.layout,
      );
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
        ...derive(state.givens, state.layout, entries),
      }));
    }

    case "tick":
    case "pause":
    case "resume":
      return timed(state, action);
  }
}

export function shownAt(
  state: SudokuPlayState,
  index: number,
): SudokuDigit | null {
  return asDigit(state.givens[index]) ?? state.entries[index] ?? null;
}

export function switchedLock(
  state: SudokuPlayState,
  index: number,
): SudokuDigit | null {
  const shown = shownAt(state, index);
  return state.status === "playing" &&
    state.locked !== null &&
    shown !== state.locked
    ? shown
    : null;
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
  layout: SudokuLayout,
  entries: readonly SudokuCellValue[],
): DerivedEntries {
  const merged = mergedGrid(givens, entries);
  return {
    entries,
    violating: new Set(getSudokuConflicts(merged, layout)),
    status: isSudokuSolved(merged, layout) ? "solved" : "playing",
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
  if (state.status !== "playing" || (state.entries[index] ?? null) === value) {
    return state;
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const derived = derive(state.givens, state.layout, entries);
  const own = clearNotes(state.notes, index);
  return {
    ...state,
    ...derived,
    notes:
      value !== null && cleanNotes
        ? withoutPeerNote(own, index, value, state.layout)
        : own,
  };
}

function restore(
  state: SudokuPlayState,
  record: PlayRecord | undefined,
  now: number,
): SudokuPlayState {
  if (record?.game !== "sudoku") {
    return hydratedAt(state, now);
  }
  const derived = derive(state.givens, state.layout, record.entries);
  const notes = (record.notes ?? NO_NOTES).map((mask, index) =>
    state.givens[index] !== 0 || record.entries[index] !== null ? 0 : mask,
  );
  return {
    ...restoredFrom(state, record, now),
    ...derived,
    notes,
    hint: idleHint(record.hintsUsed),
  };
}
