import type { DailyQueensResponse, QueensSize } from "@miolos/core";
import {
  findQueensViolations,
  isValidQueensSolution,
  type QueensBoard,
  type QueensGrid,
} from "@miolos/games/queens";

import { nextBinaryHint } from "../play/grid-hint";
import { movedSelection } from "../play/grid-selection";
import type { PlayRecord, QueensPlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";

export type QueensMark = 0 | 1;

export type QueensCellValue = QueensMark | null;

export interface QueensPlayState extends PlayCore {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly entries: readonly QueensCellValue[];
  readonly conflicts: ReadonlySet<number>;
  readonly selected: number | null;
  readonly hint: HintState;
  readonly status: "playing" | "solved";
}

export type QueensPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "cycle"; readonly index: number }
  | { readonly type: "cross-over"; readonly index: number }
  | { readonly type: "enter-value"; readonly value: QueensMark }
  | { readonly type: "clear-cell" }
  | { readonly type: "use-hint"; readonly solution: QueensGrid };

export function initQueensPlayState(
  daily: DailyQueensResponse,
): QueensPlayState {
  return {
    date: daily.date,
    size: daily.size,
    regions: daily.regions,
    entries: daily.regions.map(() => null),
    conflicts: new Set(),
    selected: null,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function queensPlayReducer(
  state: QueensPlayState,
  action: QueensPlayAction,
): QueensPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "select":
      if (cellValue(state, action.index) === undefined) {
        return state;
      }
      return state.selected === action.index
        ? state
        : { ...state, selected: action.index };

    case "move-selection": {
      const next = movedSelection(state.selected, action, state.size);
      return state.selected === next ? state : { ...state, selected: next };
    }

    case "cycle": {
      const current = cellValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      return withEntry(state, action.index, cycled(current));
    }

    case "cross-over":
      return cellValue(state, action.index) === null
        ? withEntry(state, action.index, 0)
        : state;

    case "enter-value": {
      const current = cellValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return state;
      }
      return withEntry(
        state,
        state.selected,
        current === action.value ? null : action.value,
      );
    }

    case "clear-cell":
      return state.selected === null
        ? state
        : withEntry(state, state.selected, null);

    case "use-hint": {
      if (state.hint.used >= state.hint.free || state.status !== "playing") {
        return state;
      }
      const hint = nextBinaryHint(action.solution, state.entries);
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
  }
}

export function queensGrid(entries: readonly QueensCellValue[]): QueensGrid {
  return entries.map((entry) => (entry === 1 ? 1 : 0));
}

export function countQueens(entries: readonly QueensCellValue[]): number {
  return entries.filter((entry) => entry === 1).length;
}

function cycled(current: QueensCellValue): QueensCellValue {
  return current === null ? 0 : current === 0 ? 1 : null;
}

function cellValue(
  state: QueensPlayState,
  index: number | null,
): QueensCellValue | undefined {
  if (index === null || !Number.isInteger(index)) {
    return undefined;
  }
  return index >= 0 && index < state.entries.length
    ? (state.entries[index] ?? null)
    : undefined;
}

function withEntry(
  state: QueensPlayState,
  index: number,
  value: QueensCellValue,
): QueensPlayState {
  if (state.status !== "playing" || state.entries[index] === value) {
    return state;
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const written = derive(state, entries);
  return state.hint.lastIndex === index
    ? { ...written, hint: { ...written.hint, lastIndex: null } }
    : written;
}

function derive(
  state: QueensPlayState,
  entries: readonly QueensCellValue[],
): QueensPlayState {
  const board: QueensBoard = { size: state.size, regions: state.regions };
  const grid = queensGrid(entries);
  const status = isValidQueensSolution(board, grid) ? "solved" : "playing";
  return {
    ...state,
    entries,
    conflicts: new Set(findQueensViolations(board, grid)),
    status,
    pendingSync:
      status === "solved" && state.status !== "solved"
        ? true
        : state.pendingSync,
  };
}

function restore(
  state: QueensPlayState,
  record: PlayRecord | undefined,
  now: number,
): QueensPlayState {
  if (
    !isQueensRecord(record) ||
    record.size !== state.size ||
    record.entries.length !== state.entries.length
  ) {
    return { ...state, now, hydrated: true };
  }
  return {
    ...derive(state, record.entries),
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

function isQueensRecord(
  record: PlayRecord | undefined,
): record is QueensPlayRecord {
  return record?.game === "queens";
}
