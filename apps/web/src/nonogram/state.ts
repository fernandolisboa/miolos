import type { DailyNonogramResponse, NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import type { NonogramPlayRecord, PlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import { isPictureComplete, nextNonogramHint, solutionMarks } from "./engine";

export type NonogramMark = 0 | 1;

export type NonogramCellValue = NonogramMark | null;

export type NonogramBrush = "fill" | "cross" | "erase";

export interface NonogramPlayState extends PlayCore {
  readonly size: NonogramSize;

  readonly clues: NonogramClues;

  readonly solution: readonly NonogramMark[] | null;

  readonly entries: readonly NonogramCellValue[];

  readonly selected: number | null;
  readonly brush: NonogramBrush;
  readonly hint: HintState;
  readonly status: "playing" | "solved";
}

export type NonogramPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "set-brush"; readonly brush: NonogramBrush }
  | { readonly type: "mark-cell"; readonly index: number }
  | { readonly type: "enter-value"; readonly value: NonogramMark }
  | { readonly type: "clear-cell" }
  | { readonly type: "paint-over"; readonly index: number }
  | { readonly type: "use-hint" };

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

export function nonogramPlayReducer(
  state: NonogramPlayState,
  action: NonogramPlayAction,
): NonogramPlayState {
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
      const next = moved(state.selected, action, state.size);
      return state.selected === next ? state : { ...state, selected: next };
    }

    case "set-brush":
      return state.brush === action.brush
        ? state
        : { ...state, brush: action.brush };

    case "mark-cell": {
      const current = cellValue(state, action.index);
      if (current === undefined) {
        return state;
      }

      const value = brushValue(state.brush);
      return withEntry(state, action.index, current === value ? null : value);
    }

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

    case "clear-cell": {
      const current = cellValue(state, state.selected);
      if (
        current === null ||
        current === undefined ||
        state.selected === null
      ) {
        return state;
      }
      return withEntry(state, state.selected, null);
    }

    case "paint-over": {
      const current = cellValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      return withEntry(state, action.index, brushValue(state.brush));
    }

    case "use-hint": {
      if (
        state.hint.used >= state.hint.free ||
        state.status !== "playing" ||
        state.solution === null
      ) {
        return state;
      }
      const hint = nextNonogramHint(state.solution, state.entries);
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

function cellValue(
  state: NonogramPlayState,
  index: number | null,
): NonogramCellValue | undefined {
  if (
    index === null ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.entries.length
  ) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

function moved(
  selected: number | null,
  move: { readonly rows: number; readonly columns: number },
  size: number,
): number {
  if (selected === null) {
    return 0;
  }
  const row = clamp(Math.floor(selected / size) + move.rows, size);
  const column = clamp((selected % size) + move.columns, size);
  return row * size + column;
}

function clamp(value: number, size: number): number {
  return Math.min(Math.max(value, 0), size - 1);
}

function withEntry(
  state: NonogramPlayState,
  index: number,
  value: NonogramCellValue,
): NonogramPlayState {
  if (state.status !== "playing") {
    return state;
  }
  if ((state.entries[index] ?? null) === value) {
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
  state: NonogramPlayState,
  entries: readonly NonogramCellValue[],
): NonogramPlayState {
  const status =
    state.solution !== null && isPictureComplete(state.solution, entries)
      ? "solved"
      : "playing";
  return {
    ...state,
    entries,
    status,
    pendingSync:
      status === "solved" && state.status !== "solved"
        ? true
        : state.pendingSync,
  };
}

function restore(
  state: NonogramPlayState,
  record: PlayRecord | undefined,
  now: number,
): NonogramPlayState {
  if (
    !isNonogramRecord(record) ||
    record.size !== state.size ||
    record.entries.length !== state.entries.length
  ) {
    return { ...state, now, hydrated: true };
  }
  const derived = derive(state, record.entries);
  return {
    ...derived,
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

function isNonogramRecord(
  record: PlayRecord | undefined,
): record is NonogramPlayRecord {
  return record?.game === "nonogram";
}
