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

import {
  cycled,
  painted,
  pressedMark,
  startStroke,
  toggled,
  type Press,
  type StrokeEffect,
} from "../play/brush";
import { nextHint } from "../play/grid-hint";
import { hasHintLeft } from "../play/hint-allowance";
import type { BinairoPlayRecord, PlayRecord } from "../play/play-record";
import { resetBoard, type ResetAction } from "../play/reset-board";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";

export type CellValue = BinairoCell;

export type PaintMode =
  | { readonly kind: "cycle" }
  | { readonly kind: "paint"; readonly value: 0 | 1 };

export interface PlayState extends PlayCore {
  readonly givens: BinairoGrid;

  readonly entries: readonly CellValue[];
  readonly paint: PaintMode;
  readonly stroke: StrokeEffect | null;
  readonly hint: HintState;

  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

export type PlayAction =
  | LifecycleAction
  | ResetAction
  | { readonly type: "tap"; readonly index: number; readonly press: Press }
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
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { used: 0, lastIndex: null },
    violating: derived.violating,
    status: derived.status,
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "tap": {
      const current = playableValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      return withEntry(
        state,
        action.index,
        tapped(state.paint, current, action.press),
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
        state.paint.value,
        action.press,
      );
      const started = { ...state, stroke };
      return current === undefined
        ? started
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
      const hint = nextHint(action.solution, state.givens, state.entries);
      if (hint === null) {
        return state;
      }
      const revealed = withEntry(state, hint.index, hint.value);
      return {
        ...revealed,
        hint: {
          used: state.hint.used + 1,
          lastIndex: hint.index,
        },
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

export function mergedGrid(state: PlayState): BinairoGrid {
  return mergeGrid(state.givens, state.entries);
}

export function isSolvedGrid(grid: BinairoGrid): grid is BinairoSolvedGrid {
  return grid.every((cell) => cell !== null);
}

function mergeGrid(
  givens: BinairoGrid,
  entries: readonly CellValue[],
): BinairoGrid {
  return givens.map((given, index) => given ?? entries[index] ?? null);
}

function playableValue(state: PlayState, index: number): CellValue | undefined {
  const given = state.givens[index];
  if (given === undefined || given !== null) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

function tapped(mode: PaintMode, current: CellValue, press: Press): CellValue {
  if (mode.kind === "cycle" && press === "tap") {
    return cycled(current);
  }
  return toggled(
    current,
    pressedMark(mode.kind === "paint" ? mode.value : 1, press),
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
    hint: {
      used: record.hintsUsed,
      lastIndex: null,
    },
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
