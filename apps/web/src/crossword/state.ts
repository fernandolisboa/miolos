import {
  HINTS_PER_PUZZLE_CEILING,
  type DailyCrosswordResponse,
} from "@miolos/core";

import { movedSelection } from "../play/grid-selection";
import { hintAllowed } from "../play/hint-allowance";
import { idleHint, spentHint } from "../play/hint-state";
import {
  judgedBySolution,
  NO_MISTAKES,
  type MistakeRules,
  type MistakeState,
} from "../play/mistakes";
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
import {
  entryAt,
  flattenGrid,
  isBlock,
  isSolved,
  nextCellInEntry,
  nextEmptyCell,
  prevCellInEntry,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import { nextCrosswordHint, type CrosswordHintReason } from "./hint";

export type { CrosswordDirection } from "./grid";

export type CrosswordCellValue = string | null;

export interface CrosswordPlayState extends PlayCore {
  readonly size: number;
  readonly solution: readonly CrosswordCellValue[];
  readonly clues: readonly CrosswordClue[];

  readonly entries: readonly CrosswordCellValue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly hint: HintState<CrosswordHintReason>;

  readonly status: "playing" | "solved";
  readonly history: UndoHistory<CrosswordSnapshot>;
  readonly mistakes: MistakeState;
}

type CrosswordSnapshot = Pick<
  CrosswordPlayState,
  "entries" | "selected" | "direction" | "hint"
>;

export type CrosswordPlayAction =
  | LifecycleAction
  | ResetAction
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
  | {
      readonly type: "type-letter";
      readonly letter: string;
      readonly skipFilled: boolean;
    }
  | { readonly type: "backspace" }
  | { readonly type: "use-hint" };

export function initCrosswordPlayState(
  daily: DailyCrosswordResponse,
): CrosswordPlayState {
  const solution = flattenGrid(daily.grid);
  const entries: readonly CrosswordCellValue[] = solution.map(() => null);
  return {
    ...freshCore(daily.date),
    size: daily.grid.length,
    solution,
    clues: daily.clues,
    entries,
    selected: null,
    direction: "across",
    hint: idleHint(0),
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
  };
}

export const CROSSWORD_MISTAKES: MistakeRules<
  CrosswordPlayState,
  CrosswordPlayAction | UndoAction
> = { judge: judgedBySolution };

export const crosswordPlayReducer = undoable(
  playCrossword,
  ({ entries, selected, direction, hint }): CrosswordSnapshot => ({
    entries,
    selected,
    direction,
    hint,
  }),
);

function playCrossword(
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
      return entryAt(state.clues, state.selected, other, state.size) ===
        undefined
        ? state
        : { ...state, direction: other };
    }

    case "move-selection":
      return {
        ...state,
        selected: movedSelection(state.selected, action, state.size),
      };

    case "type-letter": {
      if (state.selected === null || isBlock(state.solution, state.selected)) {
        return state;
      }
      const entered = withEntry(state, state.selected, action.letter);
      const next = action.skipFilled
        ? nextEmptyCell(
            state.clues,
            entered.entries,
            state.selected,
            state.direction,
            state.size,
          )
        : nextInEntry(state, state.selected);
      return next === undefined ? entered : { ...entered, selected: next };
    }

    case "backspace": {
      if (state.selected === null || isBlock(state.solution, state.selected)) {
        return state;
      }
      if (state.entries[state.selected] !== null) {
        return withEntry(state, state.selected, null);
      }
      const clue = entryAt(
        state.clues,
        state.selected,
        state.direction,
        state.size,
      );
      const prev =
        clue === undefined
          ? undefined
          : prevCellInEntry(clue, state.selected, state.size);
      return prev === undefined
        ? state
        : withEntry({ ...state, selected: prev }, prev, null);
    }

    case "use-hint": {
      if (!hintAllowed(state, HINTS_PER_PUZZLE_CEILING)) {
        return state;
      }
      const hint = nextCrosswordHint(
        state.solution,
        state.clues,
        state.entries,
        state.selected,
        state.direction,
        state.size,
      );
      if (hint === null) {
        return state;
      }
      const revealed = withEntry(state, hint.index, hint.value);
      return { ...revealed, hint: spentHint(state.hint, hint) };
    }

    case "reset":
      return resetBoard(state, (entries) => ({ ...state, entries }));

    case "tick":
    case "pause":
    case "resume":
      return timed(state, action);
  }
}

function nextInEntry(
  state: CrosswordPlayState,
  index: number,
): number | undefined {
  const clue = entryAt(state.clues, index, state.direction, state.size);
  return clue === undefined
    ? undefined
    : nextCellInEntry(clue, index, state.size);
}

function withEntry(
  state: CrosswordPlayState,
  index: number,
  value: CrosswordCellValue,
): CrosswordPlayState {
  if (state.status !== "playing") {
    return state;
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  return {
    ...state,
    entries,
    status: isSolved(state.solution, entries) ? "solved" : "playing",
  };
}

function restore(
  state: CrosswordPlayState,
  record: PlayRecord | undefined,
  now: number,
): CrosswordPlayState {
  if (
    record?.game !== "crossword" ||
    record.entries.length !== state.entries.length
  ) {
    return hydratedAt(state, now);
  }
  return {
    ...restoredFrom(state, record, now),
    entries: record.entries,
    status: isSolved(state.solution, record.entries) ? "solved" : "playing",
    hint: idleHint(record.hintsUsed),
  };
}
