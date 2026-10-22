import { HINTS_PER_PUZZLE_CEILING } from "@miolos/core";

import { toggled } from "./brush";
import type { Revealed } from "./grid-hint";
import { onBoard, withCaret, type CaretWriteAction } from "./grid-selection";
import { hasHintLeft } from "./hint-allowance";
import { idleHint, spentHint, unlit } from "./hint-state";
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

export interface BinaryGridState<
  R = unknown,
  M extends number = BinaryMark,
> extends PlayCore {
  readonly size: number;
  readonly solution: readonly M[] | null;
  readonly entries: readonly (M | null)[];
  readonly selected: number | null;
  readonly hint: HintState<R>;
  readonly status: "playing" | "solved";
}

export type BinaryGridAction<M extends number = BinaryMark> =
  | LifecycleAction
  | ResetAction
  | CaretWriteAction<M>
  | { readonly type: "use-hint" };

export interface BinaryGridRules<
  S extends BinaryGridState<R, M>,
  R,
  M extends number = BinaryMark,
> {
  readonly derive: (state: S, entries: S["entries"]) => S;
  readonly hint: (state: Solved<S, M>) => Revealed<M, R> | null;
}

type Solved<S, M> = S & { readonly solution: readonly M[] };

export function binaryGridReducer<
  S extends BinaryGridState<R, M>,
  R,
  M extends number = BinaryMark,
>(state: S, action: BinaryGridAction<M>, rules: BinaryGridRules<S, R, M>): S {
  switch (action.type) {
    case "restore":
      return { ...state, now: action.now, hydrated: true };

    case "select":
    case "move-selection":
      return withCaret(state, action, state.size);

    case "enter-value": {
      const current = binaryCellValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return state;
      }
      return withBinaryEntry(
        state,
        state.selected,
        toggled(current, action.value),
        rules,
      );
    }

    case "clear-cell":
      return state.selected === null ||
        binaryCellValue(state, state.selected) === undefined
        ? state
        : withBinaryEntry(state, state.selected, null, rules);

    case "use-hint": {
      const hint = canHint(state, HINTS_PER_PUZZLE_CEILING)
        ? rules.hint(state)
        : null;
      if (hint === null) {
        return state;
      }
      const revealed = withBinaryEntry(state, hint.index, hint.value, rules);
      return { ...revealed, hint: spentHint(state.hint, hint) };
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

export function canHint<M extends number>(
  state: BinaryGridState<unknown, M>,
  limit: number | null,
): state is BinaryGridState<unknown, M> & { readonly solution: readonly M[] } {
  return (
    state.solution !== null &&
    hasHintLeft(state.hint.used, limit) &&
    state.status === "playing"
  );
}

export function binaryCellValue<M extends number>(
  state: BinaryGridState<unknown, M>,
  index: number | null,
): M | null | undefined {
  if (index === null || !onBoard(state.entries, index)) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

export function withBinaryEntry<
  S extends BinaryGridState<R, M>,
  R,
  M extends number = BinaryMark,
>(
  state: S,
  index: number,
  value: M | null,
  rules: BinaryGridRules<S, R, M>,
): S {
  if (state.status !== "playing") {
    return state;
  }
  if ((state.entries[index] ?? null) === value) {
    return unlit(state);
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const written = rules.derive(state, entries);
  return unlit(
    state.hint.lastIndex === index
      ? { ...written, hint: { ...written.hint, lastIndex: null } }
      : written,
  );
}

export function settled<S extends BinaryGridState<unknown, number>>(
  state: S,
  entries: S["entries"],
  solved: boolean,
): S {
  return {
    ...state,
    entries,
    status: solved ? "solved" : "playing",
    pendingSync: solved && state.status !== "solved" ? true : state.pendingSync,
  };
}

export function restoreBinaryRecord<S extends BinaryGridState<R>, R>(
  state: S,
  {
    record,
    now,
  }: { readonly record: PlayRecord | undefined; readonly now: number },
  game: BinaryRecord["game"],
  rules: BinaryGridRules<S, R>,
): S {
  if (
    !isBinaryRecord(record) ||
    record.game !== game ||
    record.size !== state.size ||
    record.entries.length !== state.entries.length
  ) {
    return { ...state, now, hydrated: true };
  }
  return {
    ...rules.derive(state, record.entries),
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: idleHint(record.hintsUsed),
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
