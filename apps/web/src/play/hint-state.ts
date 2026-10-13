import type { HintState } from "./types";

export function idleHint(used: number): HintState<never> {
  return { used, lastIndex: null, reason: null, spotlight: [] };
}

export function unlit<S extends { readonly hint: HintState<unknown> }>(
  state: S,
): S {
  return state.hint.spotlight.length === 0
    ? state
    : { ...state, hint: { ...state.hint, spotlight: [] } };
}

export function spentHint<R>(
  hint: HintState<R>,
  revealed: {
    readonly index: number;
    readonly reason: R;
    readonly spotlight?: readonly number[];
  },
): HintState<R> {
  return {
    used: hint.used + 1,
    lastIndex: revealed.index,
    reason: revealed.reason,
    spotlight: revealed.spotlight ?? [],
  };
}
