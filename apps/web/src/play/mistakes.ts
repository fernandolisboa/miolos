import { useMemo, useReducer, type Dispatch } from "react";

import { useSettings } from "../settings/settings";
import { isWrongAt, wrongWrite } from "./grid-hint";
import type { PlayRecord } from "./play-record";
import type { ResetAction } from "./reset-board";
import type { LifecycleAction } from "./types";
import type { Editable, UndoAction } from "./undo";
import type { StrokeAction } from "./use-stroke-controls";

export const MISTAKE_LIMIT = 3;

export interface HeldTap {
  readonly index: number;
  readonly before: unknown;
}

export interface MistakeState {
  readonly cells: readonly number[];
  readonly held: HeldTap | null;
  readonly parked: HeldTap | null;
  readonly stroke: boolean;
}

export const NO_MISTAKES: MistakeState = {
  cells: [],
  held: null,
  parked: null,
  stroke: false,
};

export interface Judged {
  readonly solution: readonly unknown[];
  readonly givens: readonly unknown[] | null;
}

export interface CellPress {
  readonly index: number;
  readonly held: boolean;
}

export interface MistakeRules<S, A> {
  readonly judge: (state: S) => Judged | null;
  readonly cross?: number;
  readonly press?: (state: S, action: A) => CellPress | null;
}

type MistakeAction = {
  readonly type: string;
  readonly record?: PlayRecord | undefined;
};

const RESTORE = "restore" satisfies LifecycleAction["type"];
const RESET = "reset" satisfies ResetAction["type"];
const UNDO = "undo" satisfies UndoAction["type"];
const REDO = "redo" satisfies UndoAction["type"];
const PAINT_OVER = "paint-over" satisfies StrokeAction["type"];
const STROKE_START = "stroke-start" satisfies StrokeAction["type"];

export function judgedBySolution(state: {
  readonly solution: readonly unknown[] | null;
}): Judged | null {
  return state.solution === null
    ? null
    : { solution: state.solution, givens: null };
}

export const SOLUTION_MISTAKES: MistakeRules<
  { readonly solution: readonly unknown[] | null },
  unknown
> = { judge: judgedBySolution, cross: 0 };

export function isFrozen(mistakes: MistakeState, enabled: boolean): boolean {
  return enabled && mistakes.cells.length >= MISTAKE_LIMIT;
}

export function withMistakes<S extends Editable, A extends MistakeAction>(
  reduce: (state: S, action: A) => S,
  rules: MistakeRules<S, A>,
  enabled: boolean,
): (state: S, action: A) => S {
  const step = (state: S, action: A): S => {
    const next = reduce(state, action);
    if (action.type === RESTORE) {
      return next.entries === state.entries
        ? next
        : marked(next, restoredMistakes(action.record));
    }
    if (action.type === RESET) {
      return next.status === "playing" ? marked(next, NO_MISTAKES) : next;
    }
    if (!enabled) {
      return state.mistakes.held === null
        ? next
        : marked(next, { ...state.mistakes, held: null });
    }
    if (isFrozen(state.mistakes, true)) {
      return changesBoard(state, next) ? state : next;
    }
    if (action.type === UNDO || action.type === REDO) {
      return marked(next, travelled(state.mistakes, next, action.type));
    }
    return counted(state, next, action, rules);
  };
  return (state, action) => unparked(step(state, action));
}

// Undo parks a hold it took back and its redo re-arms it, so Desfazer then
// Refazer never makes a held write free (ADR-0142).
function travelled(
  mistakes: MistakeState,
  next: Editable,
  direction: UndoAction["type"],
): MistakeState {
  const { held, parked } = mistakes;
  if (next.status !== "playing") {
    return settled(mistakes, next);
  }
  if (direction === REDO) {
    return parked !== null && !isBefore(next, parked)
      ? { ...mistakes, held: parked, parked: null }
      : mistakes;
  }
  return held !== null && isBefore(next, held)
    ? { ...mistakes, held: null, parked: held }
    : mistakes;
}

function unparked<S extends Editable>(state: S): S {
  return state.mistakes.parked === null || state.history.redo.length > 0
    ? state
    : marked(state, { ...state.mistakes, parked: null });
}

function isBefore(state: Editable, hold: HeldTap): boolean {
  return (state.entries[hold.index] ?? null) === hold.before;
}

function counted<S extends Editable, A extends MistakeAction>(
  state: S,
  next: S,
  action: A,
  rules: MistakeRules<S, A>,
): S {
  const continuing = action.type === PAINT_OVER;
  const judged = changesBoard(state, next) ? rules.judge(state) : null;
  if (judged === null) {
    return state.mistakes.stroke && action.type === STROKE_START
      ? marked(next, { ...state.mistakes, stroke: false })
      : next;
  }
  const press = rules.press?.(state, action) ?? null;
  const afterHold = judgedHold(state, press, judged, rules.cross);
  // A held tap judged as the third mistake ended the attempt before the
  // action that revealed it, so that action is dropped (ADR-0128).
  if (afterHold.cells.length >= MISTAKE_LIMIT) {
    return marked(state, { ...afterHold, stroke: false });
  }
  return marked(
    next,
    settled(
      written(afterHold, state, next, press, continuing, judged, rules.cross),
      next,
    ),
  );
}

function judgedHold(
  state: Editable,
  press: CellPress | null,
  judged: Judged,
  cross: number | undefined,
): MistakeState {
  const { mistakes } = state;
  const { held } = mistakes;
  if (held === null) {
    return mistakes;
  }
  if (press?.index === held.index) {
    return press.held ? mistakes : { ...mistakes, held: null };
  }
  const value = state.entries[held.index] ?? null;
  const wrong =
    value !== held.before &&
    value !== cross &&
    isWrongAt(judged.solution, judged.givens, held.index, value);
  return {
    ...mistakes,
    cells: wrong ? [...mistakes.cells, held.index] : mistakes.cells,
    held: null,
  };
}

function written(
  mistakes: MistakeState,
  state: Editable,
  next: Editable,
  press: CellPress | null,
  continuing: boolean,
  judged: Judged,
  cross: number | undefined,
): MistakeState {
  const holding = press?.held === true;
  // A gesture counts once: a drag that already counted paints on uncounted.
  const repeat = continuing && mistakes.stroke;
  const wrong =
    holding || repeat || next.hint.used !== state.hint.used
      ? null
      : wrongWrite(
          judged.solution,
          judged.givens,
          state.entries,
          next.entries,
          cross,
        );
  if (!holding && wrong === null && mistakes.stroke === repeat) {
    return mistakes;
  }
  return {
    cells: wrong === null ? mistakes.cells : [...mistakes.cells, wrong],
    held: holding
      ? (mistakes.held ?? {
          index: press.index,
          before: state.entries[press.index] ?? null,
        })
      : mistakes.held,
    parked: mistakes.parked,
    stroke: repeat || wrong !== null,
  };
}

function settled(mistakes: MistakeState, next: Editable): MistakeState {
  const { held } = mistakes;
  return held !== null && (next.status !== "playing" || isBefore(next, held))
    ? { ...mistakes, held: null }
    : mistakes;
}

function changesBoard(state: Editable, next: Editable): boolean {
  return (
    next.entries !== state.entries ||
    next.hint.used !== state.hint.used ||
    next.history.steps !== state.history.steps
  );
}

function marked<S extends Editable>(state: S, mistakes: MistakeState): S {
  return state.mistakes === mistakes ? state : { ...state, mistakes };
}

function restoredMistakes(record: PlayRecord | undefined): MistakeState {
  return record !== undefined && "mistakes" in record && record.mistakes
    ? { ...NO_MISTAKES, cells: record.mistakes }
    : NO_MISTAKES;
}

export function mistakeRecord(
  state: Editable,
  closed: boolean,
): number[] | undefined {
  const { cells } = state.mistakes;
  return closed || cells.length === 0 ? undefined : [...cells];
}

export function usePlayReducer<S extends Editable, A extends MistakeAction, I>(
  reduce: (state: S, action: A) => S,
  init: I,
  initState: (init: I) => S,
  rules: MistakeRules<S, A>,
): [S, Dispatch<A>] {
  const enabled = useSettings().mistakeLimit;
  const reducer = useMemo(
    () => withMistakes(reduce, rules, enabled),
    [reduce, rules, enabled],
  );
  return useReducer(reducer, init, initState);
}
