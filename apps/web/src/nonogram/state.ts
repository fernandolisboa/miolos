import type { DailyNonogramResponse, NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import {
  binaryCellValue,
  binaryGridReducer,
  settled,
  withBinaryEntry,
  type BinaryCellValue,
  type BinaryGridAction,
  type BinaryGridRules,
  type BinaryGridState,
  type BinaryMark,
} from "../play/binary-grid";
import { isPictureComplete, solutionMarks } from "./engine";

export type NonogramMark = BinaryMark;

export type NonogramCellValue = BinaryCellValue;

export type NonogramBrush = "fill" | "cross" | "erase";

export interface NonogramPlayState extends BinaryGridState {
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
  readonly brush: NonogramBrush;
}

export type NonogramPlayAction =
  | BinaryGridAction
  | { readonly type: "set-brush"; readonly brush: NonogramBrush }
  | { readonly type: "mark-cell"; readonly index: number }
  | { readonly type: "paint-over"; readonly index: number };

export function initNonogramPlayState(
  daily: DailyNonogramResponse,
): NonogramPlayState {
  const size = daily.size;
  return {
    date: daily.date,
    size,
    clues: daily.clues,
    solution: solutionMarks(daily.clues),
    entries: Array.from({ length: size ** 2 }, () => null),
    selected: null,
    brush: "fill",
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

const NONOGRAM_RULES: BinaryGridRules<NonogramPlayState> = {
  game: "nonogram",
  derive: (state, entries) =>
    settled(
      state,
      entries,
      state.solution !== null && isPictureComplete(state.solution, entries),
    ),
};

export function nonogramPlayReducer(
  state: NonogramPlayState,
  action: NonogramPlayAction,
): NonogramPlayState {
  switch (action.type) {
    case "set-brush":
      return state.brush === action.brush
        ? state
        : { ...state, brush: action.brush };

    case "mark-cell": {
      const current = binaryCellValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      const value = brushValue(state.brush);
      return withBinaryEntry(
        state,
        action.index,
        current === value ? null : value,
        NONOGRAM_RULES,
      );
    }

    case "paint-over":
      return binaryCellValue(state, action.index) === undefined
        ? state
        : withBinaryEntry(
            state,
            action.index,
            brushValue(state.brush),
            NONOGRAM_RULES,
          );

    default:
      return binaryGridReducer(state, action, NONOGRAM_RULES);
  }
}

function brushValue(brush: NonogramBrush): NonogramCellValue {
  switch (brush) {
    case "fill":
      return 1;
    case "cross":
      return 0;
    case "erase":
      return null;
  }
}
