import type { ColoredNonogramClues } from "@miolos/games/colored-nonogram";

import { painting, pictureSettled, pictureSnapshot } from "../nonogram/paint";
import {
  brushMark,
  type NonogramBrush,
  type NonogramPlayAction,
} from "../nonogram/state";
import {
  binaryGridReducer,
  type BinaryGridRules,
  type BinaryGridState,
} from "../play/binary-grid";
import { pressedMark, type Press, type StrokeEffect } from "../play/brush";
import { idleHint } from "../play/hint-state";
import { NO_MISTAKES, type MistakeState } from "../play/mistakes";
import { NO_HISTORY, undoable, type UndoHistory } from "../play/undo";
import { nextColoredHint, type ColoredHintReason } from "./hint";

export interface ColoredNonogramState extends BinaryGridState<
  ColoredHintReason,
  number
> {
  readonly clues: ColoredNonogramClues;
  readonly brush: NonogramBrush;
  readonly tone: number;
  readonly stroke: StrokeEffect<number> | null;
  readonly history: UndoHistory<
    Pick<ColoredNonogramState, "entries" | "selected" | "hint">
  >;
  readonly mistakes: MistakeState;
}

export type ColoredNonogramAction =
  NonogramPlayAction | { readonly type: "set-tone"; readonly tone: number };

export interface ColoredNonogramBoard {
  readonly date: string;
  readonly clues: ColoredNonogramClues;
  readonly solution: readonly number[];
}

export function initColoredNonogramState({
  date,
  clues,
  solution,
}: ColoredNonogramBoard): ColoredNonogramState {
  const { size } = clues;
  return {
    date,
    size,
    clues,
    solution,
    entries: Array.from({ length: size ** 2 }, () => null),
    selected: null,
    brush: "fill",
    tone: 1,
    stroke: null,
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

const COLORED_RULES: BinaryGridRules<
  ColoredNonogramState,
  ColoredHintReason,
  number
> = {
  derive: pictureSettled,
  hint: (state) => nextColoredHint(state.clues, state.solution, state.entries),
};

export const coloredNonogramReducer = undoable(playColored, pictureSnapshot);

function playColored(
  state: ColoredNonogramState,
  action: ColoredNonogramAction,
): ColoredNonogramState {
  switch (action.type) {
    case "set-brush":
      return state.brush === action.brush
        ? state
        : { ...state, brush: action.brush };

    case "set-tone":
      return state.brush === "fill" && state.tone === action.tone
        ? state
        : { ...state, brush: "fill", tone: action.tone };

    case "mark-cell":
    case "stroke-start":
    case "paint-over":
      return painting(
        state,
        action,
        (press) => toneFor(state, press),
        COLORED_RULES,
      );

    case "enter-value":
      return binaryGridReducer(
        state,
        { type: "enter-value", value: action.value === 1 ? state.tone : 0 },
        COLORED_RULES,
      );

    default:
      return binaryGridReducer(state, action, COLORED_RULES);
  }
}

function toneFor(state: ColoredNonogramState, press: Press): number {
  return pressedMark(brushMark(state.brush), press) === 1 ? state.tone : 0;
}
