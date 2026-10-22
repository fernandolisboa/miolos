import type { PlayCore } from "./types";

export function hintAllowed(
  state: Pick<PlayCore, "status"> & {
    readonly hint: { readonly used: number };
  },
  limit: number | null,
): boolean {
  return (
    limit !== null && state.hint.used < limit && state.status === "playing"
  );
}
