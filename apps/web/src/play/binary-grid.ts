import { nextBinaryHint } from "./grid-hint";
import { movedSelection } from "./grid-selection";
import type {
  NonogramPlayRecord,
  PlayRecord,
  QueensPlayRecord,
} from "./play-record";
import { resetBoard, type ResetAction } from "./reset-board";
import { applyTimerAction } from "./timer";
import type { HintState, LifecycleAction, PlayCore } from "./types";

export type BinaryMark = 0 | 1;

export type BinaryCellValue = BinaryMark | null;

type BinaryRecord = NonogramPlayRecord | QueensPlayRecord;

export interface BinaryGridState extends PlayCore {
  readonly size: number;
  readonly solution: readonly BinaryMark[] | null;
  readonly entries: readonly BinaryCellValue[];
  readonly selected: number | null;
  readonly hint: HintState;
  readonly status: "playing" | "solved";
}

export type BinaryGridAction =
  | LifecycleAction
  | ResetAction
  | { readonly type: "select"; readonly index: number }
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "enter-value"; readonly value: BinaryMark }
  | { readonly type: "clear-cell" }
  | { readonly type: "use-hint" };

export interface BinaryGridRules<S extends BinaryGridState> {
  readonly game: BinaryRecord["game"];
  readonly derive: (state: S, entries: readonly BinaryCellValue[]) => S;
}

export function binaryGridReducer<S extends BinaryGridState>(
  state: S,
  action: BinaryGridAction,
  rules: BinaryGridRules<S>,
): S {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now, rules);

    case "select":
      if (binaryCellValue(state, action.index) === undefined) {
        return state;
      }
      return state.selected === action.index
        ? state
        : { ...state, selected: action.index };

    case "move-selection": {
      const next = movedSelection(state.selected, action, state.size);
      return state.selected === next ? state : { ...state, selected: next };
    }

    case "enter-value": {
      const current = binaryCellValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return state;
      }
      return withBinaryEntry(
        state,
        state.selected,
        current === action.value ? null : action.value,
        rules,
      );
    }

    case "clear-cell":
      return state.selected === null ||
        binaryCellValue(state, state.selected) === undefined
        ? state
        : withBinaryEntry(state, state.selected, null, rules);

    case "use-hint": {
      const hint = canHint(state)
        ? nextBinaryHint(state.solution, state.entries)
        : null;
      if (hint === null) {
        return state;
      }
      const revealed = withBinaryEntry(state, hint.index, hint.value, rules);
      return {
        ...revealed,
        hint: { free: 1, used: state.hint.used + 1, lastIndex: hint.index },
      };
    }

    case "reset":
      return resetBoard(state, (entries) => rules.derive(state, entries));

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

export function canHint(
  state: BinaryGridState,
): state is BinaryGridState & { readonly solution: readonly BinaryMark[] } {
  return (
    state.solution !== null &&
    state.hint.used < state.hint.free &&
    state.status === "playing"
  );
}

export function binaryCellValue(
  state: BinaryGridState,
  index: number | null,
): BinaryCellValue | undefined {
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

export function withBinaryEntry<S extends BinaryGridState>(
  state: S,
  index: number,
  value: BinaryCellValue,
  rules: BinaryGridRules<S>,
): S {
  if (state.status !== "playing" || (state.entries[index] ?? null) === value) {
    return state;
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const written = rules.derive(state, entries);
  return state.hint.lastIndex === index
    ? { ...written, hint: { ...written.hint, lastIndex: null } }
    : written;
}

export function settled<S extends BinaryGridState>(
  state: S,
  entries: readonly BinaryCellValue[],
  solved: boolean,
): S {
  return {
    ...state,
    entries,
    status: solved ? "solved" : "playing",
    pendingSync: solved && state.status !== "solved" ? true : state.pendingSync,
  };
}

function restore<S extends BinaryGridState>(
  state: S,
  record: PlayRecord | undefined,
  now: number,
  rules: BinaryGridRules<S>,
): S {
  if (
    !isBinaryRecord(record) ||
    record.game !== rules.game ||
    record.size !== state.size ||
    record.entries.length !== state.entries.length
  ) {
    return { ...state, now, hydrated: true };
  }
  return {
    ...rules.derive(state, record.entries),
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

function isBinaryRecord(
  record: PlayRecord | undefined,
): record is BinaryRecord {
  return record?.game === "nonogram" || record?.game === "queens";
}
