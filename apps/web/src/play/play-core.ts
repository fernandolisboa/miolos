import { applyTimerAction, type TimerAction } from "./timer";
import type { PlayCore } from "./types";

export function freshCore(
  date: string,
): PlayCore & { readonly status: "playing" } {
  return {
    date,
    timer: { accumulatedMs: 0, runningSince: null },
    status: "playing",
    now: 0,
    hydrated: false,
  };
}

export function hydratedAt<S extends PlayCore>(state: S, now: number): S {
  return { ...state, now, hydrated: true };
}

export function restoredFrom<S extends PlayCore>(
  state: S,
  record: { readonly elapsedMs: number },
  now: number,
): S {
  return {
    ...hydratedAt(state, now),
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
  };
}

export function timed<S extends PlayCore>(state: S, action: TimerAction): S {
  return {
    ...state,
    timer: applyTimerAction(state.timer, action),
    now: action.now,
  };
}
