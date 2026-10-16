import { useMemo, useReducer, type Dispatch } from "react";

import { useSettings } from "../settings/settings";
import { isWrongAt, wrongWrite } from "./grid-hint";
import type { PlayRecord } from "./play-record";

export const MISTAKE_LIMIT = 3;

export interface HeldTap {
  readonly index: number;
  readonly before: unknown;
}

export interface MistakeState {
  readonly cells: readonly number[];
  readonly held: HeldTap | null;
  readonly stroke: boolean;
}

export const NO_MISTAKES: MistakeState = {
  cells: [],
  held: null,
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

export interface Countable {
  readonly entries: readonly unknown[];
  readonly status: "playing" | "solved" | "lost";
  readonly hint: { readonly used: number };
  readonly history: { readonly steps: readonly unknown[] };
  readonly mistakes: MistakeState;
}

type MistakeAction = {
  readonly type: string;
  readonly record?: PlayRecord | undefined;
};

export function judgedBySolution(state: {
  readonly solution: readonly unknown[] | null;
}): Judged | null {
  return state.solution === null
    ? null
    : { solution: state.solution, givens: null };
}

export function isFrozen(mistakes: MistakeState, enabled: boolean): boolean {
  return enabled && mistakes.cells.length >= MISTAKE_LIMIT;
}

export function withMistakes<S extends Countable, A extends MistakeAction>(
  reduce: (state: S, action: A) => S,
  rules: MistakeRules<S, A>,
  enabled: boolean,
): (state: S, action: A) => S {
  return (state, action) => {
    const next = reduce(state, action);
    switch (action.type) {
      case "restore":
        return marked(
          next,
          restoredMistakes(action.record, next.entries.length),
        );
      case "reset":
        return next.status === "playing" ? marked(next, NO_MISTAKES) : next;
    }
    if (!enabled) {
      return state.mistakes.held === null
        ? next
        : marked(next, { ...state.mistakes, held: null });
    }
    if (isFrozen(state.mistakes, enabled)) {
      return changesBoard(state, next) ? state : next;
    }
    if (action.type === "undo") {
      return marked(next, settled(state.mistakes, next));
    }
    return counted(state, next, action, rules);
  };
}

function counted<S extends Countable, A extends MistakeAction>(
  state: S,
  next: S,
  action: A,
  rules: MistakeRules<S, A>,
): S {
  const continuing = action.type === "paint-over";
  const before = state.mistakes;
  const judged = next.entries === state.entries ? null : rules.judge(state);
  if (judged === null) {
    return before.stroke && !continuing
      ? marked(next, { ...before, stroke: false })
      : next;
  }
  const press = rules.press?.(state, action) ?? null;
  let { cells, held } = before;
  if (held !== null && press?.index === held.index) {
    held = press.held ? held : null;
  } else if (held !== null) {
    const value = state.entries[held.index] ?? null;
    if (
      value !== held.before &&
      value !== rules.cross &&
      isWrongAt(judged.solution, judged.givens, held.index, value)
    ) {
      cells = [...cells, held.index];
      if (cells.length >= MISTAKE_LIMIT) {
        return marked(state, { cells, held: null, stroke: false });
      }
    }
    held = null;
  }

  let wrote = false;
  if (press?.held === true) {
    held ??= { index: press.index, before: state.entries[press.index] ?? null };
  } else if (action.type !== "use-hint" && !(continuing && before.stroke)) {
    const wrong = wrongWrite(
      judged.solution,
      judged.givens,
      state.entries,
      next.entries,
      rules.cross,
    );
    if (wrong !== null) {
      cells = [...cells, wrong];
      wrote = true;
    }
  }
  return marked(
    next,
    settled(
      { cells, held, stroke: continuing ? before.stroke || wrote : wrote },
      next,
    ),
  );
}

function settled(mistakes: MistakeState, next: Countable): MistakeState {
  const { held } = mistakes;
  return held !== null &&
    (next.status !== "playing" ||
      (next.entries[held.index] ?? null) === held.before)
    ? { ...mistakes, held: null }
    : mistakes;
}

function changesBoard(state: Countable, next: Countable): boolean {
  return (
    next.entries !== state.entries ||
    next.hint.used !== state.hint.used ||
    next.history.steps !== state.history.steps
  );
}

function marked<S extends Countable>(state: S, mistakes: MistakeState): S {
  return state.mistakes === mistakes ? state : { ...state, mistakes };
}

function restoredMistakes(
  record: PlayRecord | undefined,
  cellCount: number,
): MistakeState {
  const cells =
    record !== undefined && "mistakes" in record ? record.mistakes : undefined;
  return cells === undefined || cells.some((cell) => cell >= cellCount)
    ? NO_MISTAKES
    : { ...NO_MISTAKES, cells };
}

export function mistakeRecord(
  state: Countable,
  closed: boolean,
): number[] | undefined {
  const { cells } = state.mistakes;
  return closed || cells.length === 0 ? undefined : [...cells];
}

export function usePlayReducer<S extends Countable, A extends MistakeAction, I>(
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
