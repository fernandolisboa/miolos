/**
 * The React seam over the pure reducer: the solution memo, the input callbacks
 * and the game-specific half of the lifecycle's contract. Everything decidable
 * without React lives in `state.ts` and `engine.ts`; everything a play screen
 * does that is not gameplay lives in `usePlayLifecycle` (ADR-0029).
 *
 * The one rule that carries over from Binairo unchanged: **nothing here runs
 * during render**. `localStorage` is read once, in the lifecycle's mount
 * effect; `Date.now()` appears only inside effects and event handlers, never in
 * a value the first paint depends on.
 */
import type { DailySudokuResponse } from "@miolos/core";
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
import type { SudokuPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  mergedGrid,
  playableGivens,
  solutionDigits,
  solvedDigits,
} from "./engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayState,
} from "./state";

/** The hint this game reveals — a written cell, so `1`–`9`. */
export type SudokuHint = Hint<SudokuDigit>;

/** Everything the play composition needs, and nothing it does not. */
export interface SudokuPlay {
  readonly state: SudokuPlayState;
  /** Milliseconds the readouts render; derived, never accumulated. */
  readonly elapsed: number;
  /** Cells carrying a value, givens included — the frames' `{filled} de 81`. */
  readonly filled: number;
  /** False once the free hint is spent, the grid is closed, or nothing is left to reveal. */
  readonly hintReady: boolean;
  /** Which case the last hint fired, for the one-line explanation. */
  readonly hintKind: SudokuHint["kind"] | null;
  readonly selectCell: (index: number) => void;
  /**
   * Move the caret by whole rows/columns, clamped at the edges. `Home` and
   * `End` are `moveSelection(0, -8)` and `moveSelection(0, 8)`.
   */
  readonly moveSelection: (rows: number, columns: number) => void;
  /** Writes at the selected cell; re-entering the same digit clears it. */
  readonly enterDigit: (digit: SudokuDigit) => void;
  readonly clearCell: () => void;
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
export function useSudokuPlay(
  daily: DailySudokuResponse,
  remotelyClaimed = false,
): SudokuPlay {
  const [state, dispatch] = useReducer(
    sudokuPlayReducer,
    daily,
    initSudokuPlayState,
  );
  const [hintKind, setHintKind] = useState<SudokuHint["kind"] | null>(null);

  // Event handlers need the CURRENT state without re-registering listeners on
  // every keystroke; a ref synced each commit is the cheapest honest way.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { givens, entries, timer, status } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);

  // The givens in the null-is-playable convention. Memoized because both
  // readers below run on every render, and passing the RAW grid to
  // `countFilled` would report 81 of 81 filled from the first paint — `0`
  // is not nullish.
  const playable = useMemo(() => playableGivens(givens), [givens]);
  const filled = countFilled(playable, entries);

  // Measured 0.057 ms mean / 0.52 ms max on the hardest daily, memoized
  // once per page. `null` is unreachable for a uniquely-solvable
  // board but defined rather than assumed away: it simply means no hint is
  // available, and the button renders its exhausted variant.
  const solution = useMemo(() => solutionDigits(givens), [givens]);

  usePlayLifecycle({
    game: "sudoku",
    state,
    reduce: sudokuPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    // `state.now` is deliberately NOT here: `tick` returns a new state object
    // every second while these three keep their identities, so including it
    // would write a readPlayRecord + Zod parse + JSON.stringify + setItem cycle
    // once a second.
    persistDeps: [givens, entries, hintsUsed],
  });

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const enterDigit = useCallback((digit: SudokuDigit) => {
    dispatch({ type: "enter-digit", digit });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const revealHint = useCallback(() => {
    if (solution === null) {
      return;
    }
    const current = stateRef.current;
    if (
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }
    // `nextHint` is deterministic (grid-hint.ts), so selecting here and
    // letting the reducer select again cannot disagree. Reading the kind
    // matters: once the cell is revealed, a correction and a fill are
    // indistinguishable.
    const hint = nextHint(
      solution,
      playableGivens(current.givens),
      current.entries,
    );
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution]);

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
    selectCell,
    moveSelection,
    enterDigit,
    clearCell,
    revealHint,
    pause,
  };
}

/**
 * The one place a Sudoku `PlayRecord` is constructed, handed to the lifecycle
 * hook so both the in-progress write and the closing one go through it. `grid`
 * is written only for a solved board, because that is the only shape the
 * completion POST accepts and the only one the flush can rebuild a body from —
 * and `solvedDigits` is what proves it is 81 digits with no empty cell left.
 * `elapsedMs` is clamped by `writePlayRecord`, never rejected — a rejecting cap
 * would discard a player's grid rather than a suspicious number.
 *
 * `closed` rather than `solved`: the lifecycle's terminal predicate is "the
 * game is CLOSED" (ADR-0029 consequence (e)). For Sudoku the two coincide,
 * because its `status` union has no `lost`.
 */
function buildRecord(
  state: SudokuPlayState,
  now: number,
  closed: boolean,
): SudokuPlayRecord {
  const solved = closed
    ? solvedDigits(mergedGrid(state.givens, state.entries))
    : null;
  return {
    v: 1,
    game: "sudoku",
    date: state.date,
    entries: [...state.entries],
    grid: solved === null ? undefined : [...solved],
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
