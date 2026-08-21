/**
 * The React seam over the pure reducer (plan 017 §8.3, §9): the solution
 * memo, the input callbacks and the game-specific half of the lifecycle's
 * contract. Everything decidable without React lives in `state.ts` and the
 * shared `../play/*` modules; everything a play screen does that is not
 * gameplay lives in `usePlayLifecycle` (ADR-0029, plan 018 §5.4).
 *
 * The one rule that survives the extraction unchanged: **nothing here runs
 * during render** (D28). `localStorage` is read once, in the lifecycle's
 * mount effect; `Date.now()` appears only inside effects and event
 * handlers, never in a value the first paint depends on.
 */
import type { DailyBinairoResponse } from "@miolos/core";
import { solveBinairo, type BinairoGrid } from "@miolos/games/binairo";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import type { BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  initPlayState,
  isSolvedGrid,
  playReducer,
  sameMode,
  type CellValue,
  type PaintMode,
  type PlayState,
} from "./state";

/** The hint this game reveals — a cell value, so `0 | 1`. */
export type BinairoHint = Hint<CellValue>;

/** Everything the play composition needs, and nothing it does not. */
export interface BinairoPlay {
  readonly state: PlayState;
  /** Milliseconds the readouts render; derived, never accumulated (D10). */
  readonly elapsed: number;
  /** Cells carrying a value, givens included — the frames' `{filled} de 64`. */
  readonly filled: number;
  /** False once the free hint is spent, the grid is closed, or nothing is left to reveal. */
  readonly hintReady: boolean;
  /** Which case the last hint fired, for the one-line explanation (§10.2). */
  readonly hintKind: BinairoHint["kind"] | null;
  readonly tapCell: (index: number) => void;
  readonly paintOver: (index: number) => void;
  /** Pressing the active mode's button returns to cycle mode (D8). */
  readonly toggleMode: (mode: PaintMode) => void;
  readonly revealHint: () => void;
  /**
   * Freeze the clock from OUTSIDE the lifecycle (#142 step 7): the screen
   * root calls this when the server's claim wins the screen, so the 1 Hz
   * tick stops behind the remote conclusion and the preserved in-progress
   * record's `elapsedMs` stops growing. Idempotent — `pause` on a paused
   * timer is the timer reducer's no-op.
   */
  readonly pause: () => void;
}

/**
 * `remotelyClaimed` — the SERVER already claims this game on this day (#33,
 * ADR-0069), which the daily screen root reads with `useServerDayClaim` for
 * its own render-time swap to the remote completed view (#142, ADR-0065).
 * It travels as a parameter rather than being read here because
 * `play/day-state.ts` reaches `src/day/**`, and the ARCHIVE shell — which
 * calls this same hook — may contain neither in its module graph (ADR-0053
 * decision 10's "Why no endpoint", pinned by `archive-day.test.tsx`). Its only effect is to
 * suppress the `puzzle_started` report: looking at a finished day is not
 * starting an attempt. The archive omits it; an archived date's claim is
 * `undefined` by the payload's own date gate anyway.
 */
export function useBinairoPlay(
  daily: DailyBinairoResponse,
  remotelyClaimed = false,
): BinairoPlay {
  const [state, dispatch] = useReducer(playReducer, daily, initPlayState);
  const [hintKind, setHintKind] = useState<BinairoHint["kind"] | null>(null);

  // Event handlers need the CURRENT state without re-registering listeners on
  // every keystroke; a ref synced each commit is the cheapest honest way.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { givens, entries, timer, status } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);
  const filled = countFilled(givens, entries);

  // ~0.1 ms for a published daily, memoized once per page (§10.1). `null`
  // is unreachable for a uniquely-solvable board but defined rather than
  // assumed away: it simply means no hint is available.
  const solution = useMemo(() => solveBinairo(givens), [givens]);

  usePlayLifecycle({
    game: "binairo",
    state,
    reduce: playReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    // `state.now` is deliberately NOT here (plan 018 §5.4, landmine 21):
    // `tick` returns a new state object every second while these three keep
    // their identities, so including it would write a readPlayRecord + Zod
    // parse + JSON.stringify + setItem cycle once a second.
    persistDeps: [givens, entries, hintsUsed],
  });

  const tapCell = useCallback((index: number) => {
    dispatch({ type: "tap", index });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const toggleMode = useCallback((mode: PaintMode) => {
    dispatch({
      type: "set-mode",
      mode: sameMode(stateRef.current.paint, mode) ? { kind: "cycle" } : mode,
    });
  }, []);

  const revealHint = useCallback(() => {
    if (solution === null) {
      return;
    }
    const current = stateRef.current;
    if (current.hint.used >= current.hint.free || current.status === "solved") {
      return;
    }
    // `nextHint` is deterministic (grid-hint.ts), so selecting here and
    // letting the reducer select again cannot disagree. Reading the kind
    // matters: once the cell is revealed, a correction and a fill are
    // indistinguishable.
    const hint = nextHint(solution, current.givens, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution]);

  // Freeze the clock from OUTSIDE the lifecycle (#142 step 7): the screen
  // root calls this when the server's claim wins the screen, so the 1 Hz
  // tick stops behind the remote conclusion and the preserved in-progress
  // record's `elapsedMs` stops growing. Idempotent — `pause` on a paused
  // timer is the timer reducer's no-op.
  const pause = useCallback(() => {
    dispatch({ type: "pause", now: Date.now() });
  }, []);

  return {
    state,
    elapsed,
    filled,
    hintReady:
      solution !== null && hintsUsed < state.hint.free && status === "playing",
    hintKind,
    tapCell,
    paintOver,
    toggleMode,
    revealHint,
    pause,
  };
}

/**
 * The one place a Binairo `PlayRecord` is constructed (§9.1), handed to the
 * lifecycle hook so both the in-progress write and the closing one go
 * through it. `grid` is written only for a solved board, because that is the
 * only shape the completion POST accepts and the only one the flush can
 * rebuild a body from. `elapsedMs` is clamped by `writePlayRecord`, never
 * rejected — a rejecting cap would discard a player's grid rather than a
 * suspicious number.
 *
 * `closed` rather than `solved`: the lifecycle's terminal predicate is "the
 * game is CLOSED" (ADR-0029 consequence (e)). For Binairo the two coincide,
 * because its `status` union has no `lost`.
 */
function buildRecord(
  state: PlayState,
  now: number,
  closed: boolean,
): BinairoPlayRecord {
  const merged: BinairoGrid = state.givens.map(
    (given, index) => given ?? state.entries[index] ?? null,
  );
  return {
    v: 1,
    game: "binairo",
    date: state.date,
    entries: [...state.entries],
    grid: closed && isSolvedGrid(merged) ? [...merged] : undefined,
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
