import type { DailyNonogramResponse, NonogramSize } from "@miolos/core";
import { formsClue, type NonogramClues } from "@miolos/games/nonogram";

import { NO_AUTO_CROSSES, type AutoCrosses } from "../play/auto-cross";
import { pressedMark, type Press, type StrokeEffect } from "../play/brush";
import {
  binaryGridReducer,
  restoreBinaryRecord,
  type BinaryCellValue,
  type BinaryGridAction,
  type BinaryGridRules,
  type BinaryGridState,
  type BinaryMark,
} from "../play/binary-grid";
import { idleHint } from "../play/hint-state";
import { NO_MISTAKES, type MistakeState } from "../play/mistakes";
import { NO_HISTORY, undoable, type UndoHistory } from "../play/undo";
import { cellStateOf, solutionMarks } from "./engine";
import { nextNonogramHint, type NonogramHintReason } from "./hint";
import { lineCrossing, lineCrossModes } from "./line-cross";
import {
  painting,
  pictureSettled,
  pictureSnapshot,
  type PaintAction,
  type PictureSnapshot,
} from "./paint";

export type NonogramMark = BinaryMark;

export type NonogramCellValue = BinaryCellValue;

export type NonogramBrush = "fill" | "cross";

export interface NonogramPlayState extends BinaryGridState<NonogramHintReason> {
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
  readonly brush: NonogramBrush;
  readonly stroke: StrokeEffect | null;
  readonly autoCrossed: AutoCrosses;
  readonly history: UndoHistory<PictureSnapshot<NonogramPlayState>>;
  readonly mistakes: MistakeState;
}

export type NonogramPlayAction =
  | BinaryGridAction
  | PaintAction
  | { readonly type: "set-brush"; readonly brush: NonogramBrush };

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
    stroke: null,
    autoCrossed: NO_AUTO_CROSSES,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
  };
}

const NONOGRAM_RULES: BinaryGridRules<NonogramPlayState, NonogramHintReason> = {
  derive: pictureSettled,
  hint: (state) => nextNonogramHint(state.clues, state.solution, state.entries),
};

export function nonogramFormed(
  entries: readonly NonogramCellValue[],
  runs: readonly number[],
): boolean {
  return formsClue(entries.map(cellStateOf), runs);
}

export const nonogramReducers = lineCrossModes((crossing) =>
  undoable(
    lineCrossing(playNonogram, nonogramFormed, crossing),
    pictureSnapshot,
  ),
);

export const nonogramPlayReducer = nonogramReducers.off;

function playNonogram(
  state: NonogramPlayState,
  action: NonogramPlayAction,
): NonogramPlayState {
  switch (action.type) {
    case "set-brush":
      return state.brush === action.brush
        ? state
        : { ...state, brush: action.brush };

    case "mark-cell":
    case "stroke-start":
    case "paint-over":
      return painting(
        state,
        action,
        (press: Press) => pressedMark(brushMark(state.brush), press),
        NONOGRAM_RULES,
      );

    case "restore":
      return restoreBinaryRecord(state, action, "nonogram", NONOGRAM_RULES);

    default:
      return binaryGridReducer(state, action, NONOGRAM_RULES);
  }
}

export function brushMark(brush: NonogramBrush): NonogramMark {
  return brush === "fill" ? 1 : 0;
}
