import type { DailyBinairoResponse } from "@miolos/core";
import {
  findBinairoViolations,
  isValidBinairoSolution,
  type BinairoCell,
  type BinairoGrid,
  type BinairoSolvedGrid,
} from "@miolos/games/binairo";

import { nextHint } from "../play/grid-hint";
import type { BinairoPlayRecord, PlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";

export type CellValue = BinairoCell;

export type PaintMode =
  | { readonly kind: "cycle" }
  | { readonly kind: "paint"; readonly value: 0 | 1 }
  | { readonly kind: "erase" };

export interface PlayState extends PlayCore {
  readonly givens: BinairoGrid;

  readonly entries: readonly CellValue[];
  readonly paint: PaintMode;
  readonly hint: HintState;

  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

export type PlayAction =
  | LifecycleAction
  | { readonly type: "tap"; readonly index: number }
  | { readonly type: "paint-over"; readonly index: number }
  | { readonly type: "set-mode"; readonly mode: PaintMode }
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
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
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
      return withEntry(state, action.index, tapped(state.paint, current));
    }

    case "paint-over": {
      if (state.paint.kind === "cycle") {
        return state;
      }
      const current = playableValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      const value = state.paint.kind === "erase" ? null : state.paint.value;
      return withEntry(state, action.index, value);
    }

    case "set-mode":
      return { ...state, paint: action.mode };

    case "use-hint": {
      if (state.hint.used >= state.hint.free || state.status === "solved") {
        return state;
      }
      const hint = nextHint(action.solution, state.givens, state.entries);
      if (hint === null) {
        return state;
      }
      const revealed = withEntry(state, hint.index, hint.value);
      return {
        ...revealed,
        hint: { free: 1, used: state.hint.used + 1, lastIndex: hint.index },
      };
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

export function sameMode(current: PaintMode, next: PaintMode): boolean {
  if (current.kind !== next.kind) {
    return false;
  }
  return current.kind === "paint" && next.kind === "paint"
    ? current.value === next.value
    : true;
}

function tapped(mode: PaintMode, current: CellValue): CellValue {
  switch (mode.kind) {
    case "cycle":
      return current === null ? 0 : current === 0 ? 1 : null;
    case "paint":
      return current === mode.value ? null : mode.value;
    case "erase":
      return null;
  }
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
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
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
