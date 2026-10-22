import {
  HINTS_PER_PUZZLE_CEILING,
  type DailyBinairoResponse,
} from "@miolos/core";
import {
  findBinairoViolations,
  isValidBinairoSolution,
  type BinairoCell,
  type BinairoGrid,
  type BinairoSolvedGrid,
} from "@miolos/games/binairo";

import { withCaret, type CaretAction } from "../play/binary-grid";
import {
  cycled,
  painted,
  pressedMark,
  startStroke,
  toggled,
  type Press,
  type StrokeEffect,
} from "../play/brush";
import { hasHintLeft } from "../play/hint-allowance";
import { idleHint, spentHint, unlit } from "../play/hint-state";
import {
  caretPress,
  NO_MISTAKES,
  type CellPress,
  type MistakeRules,
  type MistakeState,
} from "../play/mistakes";
import type { BinairoPlayRecord, PlayRecord } from "../play/play-record";
import { resetBoard, type ResetAction } from "../play/reset-board";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import {
  NO_HISTORY,
  undoable,
  type UndoAction,
  type UndoHistory,
} from "../play/undo";
import { mergeGrid } from "./engine";
import { nextBinairoHint, type BinairoHintReason } from "./hint";

export const COLUMNS = 8;

export type CellValue = BinairoCell;

export type PaintMode =
  | { readonly kind: "cycle" }
  | { readonly kind: "paint"; readonly value: 0 | 1 };

export interface PlayState extends PlayCore {
  readonly givens: BinairoGrid;

  readonly entries: readonly CellValue[];
  readonly paint: PaintMode;
  readonly stroke: StrokeEffect | null;
  readonly selected: number | null;
  readonly hint: HintState<BinairoHintReason>;

  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
  readonly history: UndoHistory<BinairoSnapshot>;
  readonly mistakes: MistakeState;
}

type BinairoSnapshot = Pick<
  PlayState,
  "entries" | "violating" | "selected" | "hint"
>;

export type PlayAction =
  | LifecycleAction
  | ResetAction
  | CaretAction
  | { readonly type: "enter-value"; readonly value: 0 | 1 }
  | { readonly type: "clear-cell" }
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
  | { readonly type: "use-hint"; readonly solution: BinairoSolvedGrid }
  | { readonly type: "mark-synced" };

export function initPlayState(daily: DailyBinairoResponse): PlayState {
  const givens: BinairoGrid = daily.givens;
  const entries: readonly CellValue[] = givens.map(() => null);
  const derived = derive(givens, entries);
  return {
    date: daily.date,
    givens,
    entries: derived.entries,
    paint: { kind: "cycle" },
    stroke: null,
    selected: null,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    violating: derived.violating,
    status: derived.status,
    pendingSync: false,
    now: 0,
    hydrated: false,
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
  };
}

export function binairoMistakes(
  solution: BinairoSolvedGrid | null,
  givens: BinairoGrid,
): MistakeRules<PlayState, PlayAction | UndoAction> {
  const judged = solution === null ? null : { solution, givens };
  return { judge: () => judged, press: binairoPress };
}

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
    selected,
    hint,
  }),
);

function playBinairo(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "select":
    case "move-selection":
      return withCaret(state, action, COLUMNS);

    case "enter-value":
      return writtenAtCaret(state, (current) => toggled(current, action.value));

    case "clear-cell":
      return writtenAtCaret(state, () => null);

    case "tap": {
      const current = playableValue(state, action.index);
      if (current === undefined) {
        return unlit(state);
      }
      return withEntry(
        state,
        action.index,
        tapped(state.paint, current, action.press, action.first),
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
        : withEntry(started, action.index, first);
    }

    case "paint-over": {
      const current = playableValue(state, action.index);
      if (current === undefined || state.stroke === null) {
        return state;
      }
      return withEntry(state, action.index, painted(state.stroke, current));
    }

    case "set-mode":
      return {
        ...state,
        paint:
          state.paint.kind === "paint" && state.paint.value === action.value
            ? { kind: "cycle" }
            : { kind: "paint", value: action.value },
      };

    case "use-hint": {
      if (!canHint(state, HINTS_PER_PUZZLE_CEILING)) {
        return state;
      }
      const hint = nextBinairoHint(
        action.solution,
        state.givens,
        state.entries,
      );
      if (hint === null) {
        return state;
      }
      const revealed = withEntry(state, hint.index, hint.value);
      return { ...revealed, hint: spentHint(state.hint, hint) };
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

export function mergedGrid(state: PlayState): BinairoGrid {
  return mergeGrid(state.givens, state.entries);
}

export function isSolvedGrid(grid: BinairoGrid): grid is BinairoSolvedGrid {
  return grid.every((cell) => cell !== null);
}

function playableValue(
  state: PlayState,
  index: number | null,
): CellValue | undefined {
  if (index === null || state.givens[index] !== null) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

function writtenAtCaret(
  state: PlayState,
  next: (current: CellValue) => CellValue,
): PlayState {
  const { selected } = state;
  const current = playableValue(state, selected);
  return current === undefined || selected === null
    ? state
    : withEntry(state, selected, next(current));
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

interface DerivedEntries {
  readonly entries: readonly CellValue[];
  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

function derive(
  givens: BinairoGrid,
  entries: readonly CellValue[],
): DerivedEntries {
  const merged = mergeGrid(givens, entries);
  const violating = new Set<number>();
  for (const violation of findBinairoViolations(merged)) {
    for (const cell of violation.cells) {
      violating.add(cell);
    }
  }
  return {
    entries,
    violating,
    status:
      isSolvedGrid(merged) && isValidBinairoSolution(merged)
        ? "solved"
        : "playing",
  };
}

function withEntry(
  state: PlayState,
  index: number,
  value: CellValue,
): PlayState {
  if (state.status !== "playing") {
    return state;
  }
  if ((state.entries[index] ?? null) === value) {
    return unlit(state);
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const derived = derive(state.givens, entries);
  return unlit({
    ...state,
    ...derived,
    pendingSync: derived.status === "solved" ? true : state.pendingSync,
  });
}

function restore(
  state: PlayState,
  record: PlayRecord | undefined,
  now: number,
): PlayState {
  if (!isBinairoRecord(record)) {
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

function isBinairoRecord(
  record: PlayRecord | undefined,
): record is BinairoPlayRecord {
  return record?.game === "binairo";
}

export function canHint(state: PlayState, limit: number | null): boolean {
  return hasHintLeft(state.hint.used, limit) && state.status !== "solved";
}
