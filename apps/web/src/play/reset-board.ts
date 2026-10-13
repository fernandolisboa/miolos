import type { HintState, PlayCore } from "./types";

export type ResetAction = { readonly type: "reset" };

export function hasEntries(entries: readonly unknown[]): boolean {
  return entries.some((entry) => entry !== null);
}

export function resetBoard<
  S extends PlayCore & {
    readonly entries: readonly unknown[];
    readonly hint: HintState;
  },
>(state: S, rederive: (entries: readonly null[]) => S): S {
  if (state.status !== "playing" || !hasEntries(state.entries)) {
    return state;
  }
  return {
    ...rederive(state.entries.map(() => null)),
    hint: { ...state.hint, lastIndex: null },
  };
}
