import { useCallback, type Dispatch } from "react";

import { unlit } from "./hint-state";
import { hasDecidedCell, type ResetAction } from "./reset-board";
import type { HintState, PlayCore } from "./types";

const UNDO_LIMIT = 200;

export type UndoAction = { readonly type: "undo" };

export interface UndoHistory<T> {
  readonly steps: readonly T[];
  readonly open: boolean;
}

export const NO_HISTORY: UndoHistory<never> = { steps: [], open: false };

export interface Undoable<T> extends PlayCore {
  readonly entries: readonly unknown[];
  readonly hint: HintState<unknown>;
  readonly history: UndoHistory<T>;
}

export interface BoardEdits {
  readonly onReset: (() => void) | null;
  readonly onUndo: (() => void) | null;
}

export function useBoardEdits(
  state: Undoable<unknown>,
  dispatch: Dispatch<ResetAction | UndoAction>,
): BoardEdits {
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, [dispatch]);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, [dispatch]);

  return {
    onReset: hasDecidedCell(state.entries) ? reset : null,
    onUndo:
      state.status === "playing" && state.history.steps.length > 0
        ? undo
        : null,
  };
}

export function undoable<
  S extends Undoable<T>,
  T extends Partial<S> & { readonly entries: S["entries"] },
  A extends { readonly type: string },
>(
  reduce: (state: S, action: A) => S,
  snapshot: (state: S) => T,
): (state: S, action: A | UndoAction) => S {
  return (state, action) => {
    if (action.type === "undo") {
      return undone(state);
    }
    const next = reduce(state, action as A);
    if (
      action.type === "restore" ||
      next.hint.used !== state.hint.used ||
      (action.type === "reset" && next !== state)
    ) {
      return { ...next, history: NO_HISTORY };
    }
    if (next.entries === state.entries) {
      return action.type === "stroke-start" && state.history.open
        ? { ...next, history: { steps: state.history.steps, open: false } }
        : next;
    }
    const { steps, open } = state.history;
    if (
      open &&
      (action.type === "paint-over" || action.type === "lock-digit")
    ) {
      const opening = steps.at(-1);
      return opening !== undefined && sameEntries(opening.entries, next.entries)
        ? { ...next, history: { steps: steps.slice(0, -1), open: false } }
        : next;
    }
    if (sameEntries(state.entries, next.entries)) {
      return next;
    }
    return {
      ...next,
      history: {
        steps: [...steps, snapshot(state)].slice(-UNDO_LIMIT),
        open: true,
      },
    };
  };
}

function undone<S extends Undoable<T>, T extends Partial<S>>(state: S): S {
  const step = state.history.steps.at(-1);
  if (state.status !== "playing" || step === undefined) {
    return state;
  }
  return unlit({
    ...state,
    ...step,
    history: { steps: state.history.steps.slice(0, -1), open: false },
  });
}

function sameEntries(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((entry, at) => entry === b[at]);
}
