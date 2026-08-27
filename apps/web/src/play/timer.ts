import type { LifecycleAction } from "./types";

export interface TimerState {
  readonly accumulatedMs: number;

  readonly runningSince: number | null;
}

export type TimerAction = Extract<
  LifecycleAction,
  { readonly type: "tick" | "pause" | "resume" }
>;

export function elapsedMs(timer: TimerState, now: number): number {
  return (
    timer.accumulatedMs +
    (timer.runningSince === null ? 0 : now - timer.runningSince)
  );
}

export function applyTimerAction(
  timer: TimerState,
  action: TimerAction,
): TimerState {
  switch (action.type) {
    case "tick":
      return timer;

    case "pause":
      if (timer.runningSince === null) {
        return timer;
      }
      return {
        accumulatedMs: elapsedMs(timer, action.now),
        runningSince: null,
      };

    case "resume":
      if (timer.runningSince !== null) {
        return timer;
      }
      return { ...timer, runningSince: action.now };
  }
}
