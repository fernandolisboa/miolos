import type { DailyBinairoResponse } from "@miolos/core";
import {
  BINAIRO_SIZE,
  findBinairoViolations,
  isValidBinairoSolution,
  type BinairoCell,
  type BinairoGrid,
  type BinairoSolvedGrid,
} from "@miolos/games/binairo";

import {
  binaryGridReducer,
  restoreBinaryRecord,
  settled,
  withBinaryEntry,
  type BinaryGridAction,
  type BinaryGridRules,
  type BinaryGridState,
} from "../play/binary-grid";
import {
  cycled,
  painted,
  pressedMark,
  startStroke,
  toggled,
  type Press,
  type StrokeEffect,
} from "../play/brush";
import { idleHint, unlit } from "../play/hint-state";
import {
  caretPress,
  NO_MISTAKES,
  type CellPress,
  type MistakeRules,
  type MistakeState,
} from "../play/mistakes";
import {
  NO_HISTORY,
  undoable,
  type UndoAction,
  type UndoHistory,
} from "../play/undo";
import { mergeGrid } from "./engine";
import { nextBinairoHint, type BinairoHintReason } from "./hint";

export type CellValue = BinairoCell;

export type PaintMode =
  | { readonly kind: "cycle" }
  | { readonly kind: "paint"; readonly value: 0 | 1 };

export interface PlayState extends BinaryGridState<BinairoHintReason> {
  readonly solution: BinairoSolvedGrid | null;
  readonly givens: BinairoGrid;
  readonly paint: PaintMode;
  readonly stroke: StrokeEffect | null;
  readonly violating: ReadonlySet<number>;
  readonly history: UndoHistory<BinairoSnapshot>;
  readonly mistakes: MistakeState;
}

type BinairoSnapshot = Pick<PlayState, "entries" | "violating" | "hint"> &
  Partial<Pick<PlayState, "selected">>;

export type PlayAction =
  | BinaryGridAction
  | {
      readonly type: "tap";
      readonly index: number;
      readonly press: Press;
      readonly first: 0 | 1;
    }
  | {
      readonly type: "stroke-start";
      readonly index: number;
      readonly press: Press;
    }
  | { readonly type: "paint-over"; readonly index: number }
  | { readonly type: "set-mode"; readonly value: 0 | 1 }
  | { readonly type: "mark-synced" };

export function initPlayState(
  daily: DailyBinairoResponse,
  solution: BinairoSolvedGrid | null,
): PlayState {
  const givens: BinairoGrid = daily.givens;
  return {
    date: daily.date,
    size: BINAIRO_SIZE,
    solution,
    givens,
    entries: givens.map(() => null),
    paint: { kind: "cycle" },
    stroke: null,
    selected: null,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    violating: violationsOf(
      givens,
      givens.map(() => null),
    ),
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
  };
}

export const BINAIRO_MISTAKES: MistakeRules<
  PlayState,
  PlayAction | UndoAction
> = {
  judge: ({ solution, givens }) =>
    solution === null ? null : { solution, givens },
  press: binairoPress,
};

const BINAIRO_RULES: BinaryGridRules<PlayState, BinairoHintReason> = {
  derive: (state, entries) => {
    const merged = mergeGrid(state.givens, entries);
    return {
      ...settled(
        state,
        entries,
        isSolvedGrid(merged) && isValidBinairoSolution(merged),
      ),
      violating: violationsOf(state.givens, entries),
    };
  },
  hint: (state) => nextBinairoHint(state.solution, state.givens, state.entries),
};

function binairoPress(
  state: PlayState,
  action: PlayAction | UndoAction,
): CellPress | null {
  switch (action.type) {
    case "tap":
      return {
        index: action.index,
        held: state.paint.kind === "cycle" && action.press === "tap",
      };
    case "stroke-start":
    case "paint-over":
      return { index: action.index, held: false };
    case "enter-value":
    case "clear-cell":
      return caretPress(state.selected);
    default:
      return null;
  }
}

export const playReducer = undoable(
  playBinairo,
  ({ entries, violating, selected, hint }): BinairoSnapshot => ({
    entries,
    violating,
    ...(selected === null ? {} : { selected }),
    hint,
  }),
);

function playBinairo(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "restore":
      return restoreBinaryRecord(state, action, "binairo", BINAIRO_RULES);

    case "enter-value":
    case "clear-cell":
      return state.selected !== null && state.givens[state.selected] !== null
        ? state
        : binaryGridReducer(state, action, BINAIRO_RULES);

    case "tap": {
      const current = playableValue(state, action.index);
      if (current === undefined) {
        return unlit(state);
      }
      return withBinaryEntry(
        state,
        action.index,
        tapped(state.paint, current, action.press, action.first),
        BINAIRO_RULES,
      );
    }

    case "stroke-start": {
      if (state.paint.kind === "cycle") {
        return state;
      }
      if (state.givens[action.index] === undefined) {
        return { ...state, stroke: null };
      }
      const current = playableValue(state, action.index);
      const { stroke, first } = startStroke(
        current ?? null,
        pressedMark(state.paint.value, action.press),
      );
      const started = { ...state, stroke };
      return current === undefined
        ? unlit(started)
        : withBinaryEntry(started, action.index, first, BINAIRO_RULES);
    }

    case "paint-over": {
      const current = playableValue(state, action.index);
      if (current === undefined || state.stroke === null) {
        return state;
      }
      return withBinaryEntry(
        state,
        action.index,
        painted(state.stroke, current),
        BINAIRO_RULES,
      );
    }

    case "set-mode":
      return {
        ...state,
        paint:
          state.paint.kind === "paint" && state.paint.value === action.value
            ? { kind: "cycle" }
            : { kind: "paint", value: action.value },
      };

    case "mark-synced":
      return state.pendingSync ? { ...state, pendingSync: false } : state;

    default:
      return binaryGridReducer(state, action, BINAIRO_RULES);
  }
}

export function mergedGrid(state: PlayState): BinairoGrid {
  return mergeGrid(state.givens, state.entries);
}

export function isSolvedGrid(grid: BinairoGrid): grid is BinairoSolvedGrid {
  return grid.every((cell) => cell !== null);
}

function playableValue(state: PlayState, index: number): CellValue | undefined {
  const given = state.givens[index];
  if (given === undefined || given !== null) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

function tapped(
  mode: PaintMode,
  current: CellValue,
  press: Press,
  first: 0 | 1,
): CellValue {
  if (mode.kind === "cycle" && press === "tap") {
    return cycled(current, first);
  }
  return toggled(
    current,
    pressedMark(mode.kind === "paint" ? mode.value : first, press),
  );
}

function violationsOf(
  givens: BinairoGrid,
  entries: readonly CellValue[],
): ReadonlySet<number> {
  const violating = new Set<number>();
  for (const violation of findBinairoViolations(mergeGrid(givens, entries))) {
    for (const cell of violation.cells) {
      violating.add(cell);
    }
  }
  return violating;
}
