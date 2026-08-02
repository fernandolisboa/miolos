/**
 * The React seam over the pure reducer (plan 020 §10.5): the derived
 * readouts, the input callbacks and the game-specific half of the
 * lifecycle's contract. Everything decidable without React lives in
 * `state.ts` and `engine.ts`; everything a play screen does that is not
 * gameplay lives in `usePlayLifecycle` (ADR-0029).
 *
 * The one rule that carries over from the two shipped games unchanged:
 * **nothing here runs during render** (plan 017 D28). `localStorage` is read
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
 * anyway, since the reducer still needs the value in state (§10.4).
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
  /** Cells the player has filled — the readout's numerator (P13). */
  readonly filled: number;
  /** The picture's cell count, summed from the CLUES. */
  readonly target: number;
  /**
   * False when the clues did not solve, once the free hint is spent, or once
   * the board is closed — the three terms the expression actually carries.
   *
   * There is deliberately NO "a hint still exists" term: `nextNonogramHint`
   * returns null only on a board where every cell already equals the
   * solution, and that is exactly `isPictureComplete`, which closes the board
   * as `solved`. So the missing condition is implied by the closed one.
   */
  readonly hintReady: boolean;
  /** Which case the last hint fired, for the one-line explanation (P18). */
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
}

export function useNonogramPlay(daily: DailyNonogramResponse): NonogramPlay {
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
    // `state.now` is deliberately NOT here (use-play-lifecycle.ts:66-69,
    // landmine 21). `solution` and `clues` are absent for a different reason:
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
 * `size` is written as a DATUM (P15): `sync.ts` builds the POST body from
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
