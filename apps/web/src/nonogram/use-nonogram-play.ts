/**
 * The React seam over the pure reducer: the derived
 * readouts, the input callbacks and the game-specific half of the
 * lifecycle's contract. Everything decidable without React lives in
 * `state.ts` and `engine.ts`; everything a play screen does that is not
 * gameplay lives in `usePlayLifecycle` (ADR-0029).
 *
 * The one rule that carries over from the two shipped games unchanged:
 * **nothing here runs during render**. `localStorage` is read
 * once, in the lifecycle's mount effect; `Date.now()` appears only inside
 * effects and event handlers, never in a value the first paint depends on.
 *
 * The solve is the one exception worth naming rather than hiding: it runs in
 * the `useReducer` INITIALIZER, once per mount, measured at 0.084 ms on a
 * 15×15 — including on the server render, where the screen paints
 * `PlaySkeleton` anyway and the state never enters the RSC payload (only
 * `daily` crosses). It is deliberately NOT hoisted out of this hook to make
 * the unavailable branch cheaper: hoisting would forfeit the record restore,
 * the prune and the queue flush that the lifecycle's ungated mount effect
 * performs on that route, and would run `solutionMarks` twice per mount
 * anyway, since the reducer still needs the value in state.
 */
import type { DailyNonogramResponse } from "@miolos/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { NonogramPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  countFilledCells,
  filledTarget,
  hintKindOf,
  nextNonogramHint,
  submittedCells,
  type NonogramHintKind,
} from "./engine";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramBrush,
  type NonogramMark,
  type NonogramPlayState,
} from "./state";

/** Everything the play composition needs, and nothing it does not. */
export interface NonogramPlay {
  readonly state: NonogramPlayState;
  /** Milliseconds the readouts render; derived, never accumulated. */
  readonly elapsed: number;
  /** Cells the player has filled — the readout's numerator. */
  readonly filled: number;
  /** The picture's cell count, summed from the CLUES. */
  readonly target: number;
  /**
   * False when the clues did not solve, once the free hint is spent, or once
   * the board is closed — the three terms the expression actually carries.
   *
   * There is deliberately NO "a hint still exists" term, and the argument
   * runs from the CLOSED term rather than through an equivalence: while
   * `status === "playing"` the picture is incomplete, so some index disagrees
   * with the solution — a written cell that is wrong (pass 1 returns a
   * `correction`) or an unpainted picture cell (pass 2 returns a `fill`).
   * Either way `nextNonogramHint` is non-null, so the missing condition is
   * implied by the closed one.
   *
   * The converse does NOT hold: `nextNonogramHint` returns null strictly less
   * often than `isPictureComplete` is true. A finished picture whose empty
   * cells are left undecided satisfies `isPictureComplete` while the hint
   * search still hands back a cross through its `?? first` fallback — so that
   * fallback is live in the pure function, not dead code.
   */
  readonly hintReady: boolean;
  /** Which case the last hint fired, for the one-line explanation. */
  readonly hintKind: NonogramHintKind | null;
  readonly selectCell: (index: number) => void;
  /**
   * Move the caret by whole rows/columns, clamped at the edges. `Home` and
   * `End` are a full-width clamped move.
   */
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly setBrush: (brush: NonogramBrush) => void;
  /** Applies the brush at `index`; re-applying the brush's value clears it. */
  readonly markCell: (index: number) => void;
  /** A keyboard write of a specific value, whatever the brush is. */
  readonly enterValue: (value: NonogramMark) => void;
  readonly clearCell: () => void;
  /** A drag: an idempotent SET of the brush's value, never a toggle. */
  readonly paintOver: (index: number) => void;
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
export function useNonogramPlay(
  daily: DailyNonogramResponse,
  remotelyClaimed = false,
): NonogramPlay {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    daily,
    initNonogramPlayState,
  );
  const [hintKind, setHintKind] = useState<NonogramHintKind | null>(null);

  // Event handlers need the CURRENT state without re-registering listeners on
  // every stroke; a ref synced each commit is the cheapest honest way.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { clues, entries, timer, status, solution } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);

  // The denominator, from the CLUES and never from the solution — public,
  // solve-free and O(runs). Memoized on the board constant, which never
  // changes for a mounted screen.
  const target = useMemo(() => filledTarget(clues), [clues]);
  const filled = countFilledCells(entries);

  usePlayLifecycle({
    game: "nonogram",
    state,
    reduce: nonogramPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    // `state.now` is deliberately NOT here — see `persistDeps` in
    // `use-play-lifecycle.ts`. `solution` and `clues` are absent for a different reason:
    // `buildRecord` never reads them, and a dependency that cannot change the
    // record's content does not belong in the array that means "the record's
    // CONTENT changed".
    //
    // `size` is a third case and the strongest of the three — `buildRecord`
    // DOES read it, twice — so it is spelled out rather than lumped in:
    // `state.size` comes from `daily.size` and no reducer case resizes the
    // board, so it is fixed for the life of this mount. Binairo and Sudoku
    // both list their board constant; if `size` ever becomes state, it joins
    // this array in the same edit.
    persistDeps: [state.entries, state.hint.used],
  });

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const setBrush = useCallback((brush: NonogramBrush) => {
    dispatch({ type: "set-brush", brush });
  }, []);

  const markCell = useCallback((index: number) => {
    dispatch({ type: "mark-cell", index });
  }, []);

  const enterValue = useCallback((value: NonogramMark) => {
    dispatch({ type: "enter-value", value });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (
      current.solution === null ||
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }
    // `nextNonogramHint` is deterministic (engine.ts), so selecting here and
    // letting the reducer select again cannot disagree. Reading the kind
    // matters: once the cell is revealed, a correction and a fill are
    // indistinguishable.
    const hint = nextNonogramHint(current.solution, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hintKindOf(hint));
    dispatch({ type: "use-hint" });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: "pause", now: Date.now() });
  }, []);

  return {
    state,
    elapsed,
    filled,
    target,
    hintReady:
      solution !== null && hintsUsed < state.hint.free && status === "playing",
    hintKind,
    selectCell,
    moveSelection,
    setBrush,
    markCell,
    enterValue,
    clearCell,
    paintOver,
    revealHint,
    pause,
  };
}

/**
 * The one place a Nonogram `PlayRecord` is constructed, handed to the
 * lifecycle hook so both the in-progress write and the closing one go
 * through it. MODULE-LEVEL, so the hook's ref is stable.
 *
 * `grid` is written only for a closed board, because that is the only shape
 * the completion POST accepts and the only one the flush can rebuild a body
 * from — and `submittedCells` is what proves it is exactly `size²` cells,
 * which no fixed `.length()` downstream can do for a board that is 5, 8, 10
 * or 15 a side. `elapsedMs` is clamped by `writePlayRecord`, never rejected:
 * a rejecting cap would discard a player's board rather than a suspicious
 * number.
 *
 * `size` is written as a DATUM: `sync.ts` builds the POST body from
 * the record alone with no board in scope, and the conclusion's picture
 * wrapper lays the bitmap out from it.
 *
 * `closed` rather than `solved`: the lifecycle's terminal predicate is "the
 * game is CLOSED" (ADR-0029 consequence (e)). For Nonogram the two coincide,
 * because its `status` union has no `lost`.
 */
function buildRecord(
  state: NonogramPlayState,
  now: number,
  closed: boolean,
): NonogramPlayRecord {
  const submitted = closed
    ? submittedCells(state.entries, state.size ** 2)
    : null;
  return {
    v: 1,
    game: "nonogram",
    date: state.date,
    size: state.size,
    entries: [...state.entries],
    grid: submitted === null ? undefined : [...submitted],
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
