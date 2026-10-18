import { useCallback, type Dispatch } from "react";

import { useSettings } from "../settings/settings";
import { unlit } from "./hint-state";
import { isFrozen, MISTAKE_LIMIT, type MistakeState } from "./mistakes";
import { hasDecidedCell, type ResetAction } from "./reset-board";
import type { HintState, PlayCore } from "./types";

const UNDO_LIMIT = 200;

export type UndoAction = { readonly type: "undo" | "redo" };

export interface UndoHistory<T> {
  readonly steps: readonly T[];
  readonly redo: readonly T[];
  readonly open: boolean;
  readonly displaced: readonly T[];
}

export const NO_HISTORY: UndoHistory<never> = {
  steps: [],
  redo: [],
  open: false,
  displaced: [],
};

export interface Undoable<T> extends PlayCore {
  readonly entries: readonly unknown[];
  readonly hint: HintState<unknown>;
  readonly history: UndoHistory<T>;
}

export type Editable = Undoable<unknown> & {
  readonly mistakes: MistakeState;
};

export interface BoardEdits {
  readonly onReset: (() => void) | null;
  readonly onUndo: (() => void) | null;
  readonly onRedo: (() => void) | null;
  readonly mistakesLeft: number | null;
}

export function useBoardEdits(
  state: Editable,
  dispatch: Dispatch<ResetAction | UndoAction>,
  resettable = hasDecidedCell(state.entries),
): BoardEdits {
  const limit = useSettings().mistakeLimit;
  const spent = state.mistakes.cells.length;
  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, [dispatch]);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, [dispatch]);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, [dispatch]);

  const movable =
    state.status === "playing" && !isFrozen(state.mistakes, limit);

  return {
    onReset: resettable || (limit && spent > 0) ? reset : null,
    onUndo: movable && state.history.steps.length > 0 ? undo : null,
    onRedo: movable && state.history.redo.length > 0 ? redo : null,
    mistakesLeft: limit ? Math.max(MISTAKE_LIMIT - spent, 0) : null,
  };
}

type StepFields = readonly (readonly unknown[])[];

export function undoable<
  S extends Undoable<T>,
  T extends Partial<S> & { readonly entries: S["entries"] },
  A extends { readonly type: string },
>(
  reduce: (state: S, action: A) => S,
  snapshot: (state: S) => T,
  stepFields: (snap: T) => StepFields = ({ entries }) => [entries],
): (state: S, action: A | UndoAction) => S {
  return (state, action) => {
    if (action.type === "undo") {
      return undone(state, snapshot);
    }
    if (action.type === "redo") {
      return redone(state, snapshot);
    }
    const next = reduce(state, action as A);
    if (
      action.type === "restore" ||
      next.hint.used !== state.hint.used ||
      (action.type === "reset" && next !== state)
    ) {
      return { ...next, history: NO_HISTORY };
    }
    const { steps, open } = state.history;
    const before = stepFields(snapshot(state));
    const after = stepFields(snapshot(next));
    if (before.every((cells, at) => cells === after[at])) {
      return action.type === "stroke-start" && open
        ? closed(next, steps)
        : next;
    }
    // An open step is one drag or digit lock still writing: later cells add to that
    // step, and a gesture that ends where it began leaves none (ADR-0126, ADR-0142).
    if (
      open &&
      (action.type === "paint-over" || action.type === "lock-digit")
    ) {
      return continued(next, steps, (opening) =>
        sameFields(stepFields(opening), after),
      );
    }
    if (sameFields(before, after)) {
      return next;
    }
    return {
      ...next,
      history: {
        steps: [...steps, snapshot(state)].slice(-UNDO_LIMIT),
        redo: [],
        open: true,
        displaced: state.history.redo,
      },
    };
  };
}

function continued<S extends Undoable<T>, T>(
  next: S,
  steps: readonly T[],
  endsWhereItBegan: (opening: T) => boolean,
): S {
  const opening = steps.at(-1);
  return opening !== undefined && endsWhereItBegan(opening)
    ? closed(next, steps.slice(0, -1), next.history.displaced)
    : next;
}

function undone<S extends Undoable<T>, T extends Partial<S>>(
  state: S,
  snapshot: (state: S) => T,
): S {
  const { steps, redo } = state.history;
  const step = steps.at(-1);
  if (state.status !== "playing" || step === undefined) {
    return state;
  }
  return unlit(
    closed({ ...state, ...step }, steps.slice(0, -1), [
      ...redo,
      snapshot(state),
    ]),
  );
}

function redone<S extends Undoable<T>, T extends Partial<S>>(
  state: S,
  snapshot: (state: S) => T,
): S {
  const { steps, redo } = state.history;
  const step = redo.at(-1);
  if (state.status !== "playing" || step === undefined) {
    return state;
  }
  return unlit(
    closed(
      { ...state, ...step },
      [...steps, snapshot(state)].slice(-UNDO_LIMIT),
      redo.slice(0, -1),
    ),
  );
}

function closed<S extends Undoable<T>, T>(
  state: S,
  steps: readonly T[],
  redo: readonly T[] = state.history.redo,
): S {
  return { ...state, history: { steps, redo, open: false, displaced: [] } };
}

function sameFields(a: StepFields, b: StepFields): boolean {
  return a.every((cells, at) => {
    const other = b[at] ?? [];
    return (
      cells.length === other.length &&
      cells.every((cell, index) => cell === other[index])
    );
  });
}
