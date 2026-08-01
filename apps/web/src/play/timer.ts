/**
 * The count-up clock every play screen shares (ADR-0029, plan 018 §5.2).
 * Moved verbatim out of `binairo/state.ts`: pure, no React, no DOM, no
 * clock read — every action that needs the time carries it, which is what
 * keeps both games' reducers pure.
 */
import type { LifecycleAction } from "./types";

/**
 * Count-up timer. Elapsed is DERIVED from a running-segment start, never
 * accumulated by a tick (plan 017 D10) — a throttled background tab cannot
 * drift a clock it does not increment.
 */
export interface TimerState {
  readonly accumulatedMs: number;
  /** Client epoch ms of the current running segment, or null while paused. */
  readonly runningSince: number | null;
}

/** The lifecycle actions that only move the clock. */
export type TimerAction = Extract<
  LifecycleAction,
  { readonly type: "tick" | "pause" | "resume" }
>;

/** accumulatedMs + (runningSince === null ? 0 : now - runningSince). */
export function elapsedMs(timer: TimerState, now: number): number {
  return (
    timer.accumulatedMs +
    (timer.runningSince === null ? 0 : now - timer.runningSince)
  );
}

/**
 * The clock half of every reducer's `tick`/`pause`/`resume`. It returns the
 * SAME object whenever the timer does not move, which is load-bearing and
 * not a micro-optimisation: `timer` is a persist dependency (plan 018 §5.4),
 * so a fresh object on every tick would write a full parse-and-serialize
 * cycle to `localStorage` once a second. The caller still returns a new
 * state — `now` always moves.
 */
export function applyTimerAction(
  timer: TimerState,
  action: TimerAction,
): TimerState {
  switch (action.type) {
    case "tick":
      // Only nudges a re-render: the displayed value always comes from
      // `elapsedMs(timer, now)`, so a tick can never accumulate.
      return timer;

    case "pause":
      // Idempotent, and load-bearing: `visibilitychange → hidden` followed
      // by `pagehide` fires twice on a real navigation away, and a second
      // pause would fold the same segment in twice.
      if (timer.runningSince === null) {
        return timer;
      }
      return {
        accumulatedMs: elapsedMs(timer, action.now),
        runningSince: null,
      };

    case "resume":
      // Idempotent, and load-bearing: a second resume would overwrite
      // `runningSince` and silently discard every millisecond since the
      // previous one — exactly the drift D10 exists to prevent. Double
      // resumes are ordinary (StrictMode, a `visible` with no preceding
      // `hidden`, a bfcache restore firing both pageshow and
      // visibilitychange).
      if (timer.runningSince !== null) {
        return timer;
      }
      return { ...timer, runningSince: action.now };
  }
}
