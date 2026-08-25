/**
 * The whole Sudoku gameplay state machine, as one pure
 * reducer over one immutable value: no React, no DOM, no clock. Every
 * action that needs the time carries it, so the reducer stays pure and the
 * screen stays thin — most of the gameplay test surface is
 * plain unit tests.
 *
 * The input model is CELL-FIRST: select a cell, then type or tap a
 * digit. Binairo's sticky paint mode does not generalize — there is no
 * plausible "paint 7s by dragging" — and cell-first gives the physical
 * keyboard's `1`–`9` and Backspace for free, which at 81 cells matters.
 *
 * Three invariants hold everywhere below:
 * - `entries[i]` is always `null` where `givens[i]` is a clue: givens are
 *   immutable and every write path skips them.
 * - `violating` and `status` are DERIVED from the merged grid and are
 *   recomputed on every entry change, never patched incrementally.
 * - `selected` is BOTH the selection and the roving-focus caret — one
 *   concept, so the focus ring and the selected cell can never disagree
 *   (ADR-0030).
 */
import type { DailySudokuResponse } from "@miolos/core";
import {
  getSudokuConflicts,
  isSudokuSolved,
  type SudokuGrid,
  type SudokuTier,
} from "@miolos/games/sudoku";

import { nextHint } from "../play/grid-hint";
import type { PlayRecord, SudokuPlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import { mergedGrid, playableGivens } from "./engine";

/** The 9×9 board's side, and the source of every row/column bound below. */
const SIDE = 9;

/**
 * What a player may write. `null` is the client's empty cell; the engine's
 * `0` sentinel never reaches this type, and the conversion happens at
 * exactly one boundary, `engine.ts`.
 *
 * It mirrors `@miolos/core`'s `sudokuDigitSchema` rather than being derived
 * from it, so that this module stays free of Zod; the two are pinned
 * together by the play record, which is written from `entries` and parsed
 * against that schema — a drift between them is a typecheck failure, not a
 * runtime surprise.
 */
export type SudokuDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SudokuCellValue = SudokuDigit | null;

/**
 * `status` narrows `PlayCore`'s three-member union to the two Sudoku has:
 * `lost` is Termo-only (ADR-0008), and the lifecycle's terminal predicate
 * is `status !== "playing"`, which coincides with `=== "solved"` here.
 */
export interface SudokuPlayState extends PlayCore {
  /** Engine-native: 0 = empty. Fed straight to the solver, never converted. */
  readonly givens: SudokuGrid;
  /** 81 entries; always null at a given's index. */
  readonly entries: readonly SudokuCellValue[];
  /** The selected cell AND the roving-focus caret — one concept. */
  readonly selected: number | null;
  /** On the wire; rendered as the `Nível` readout, never recomputed. */
  readonly tier: SudokuTier;
  readonly hint: HintState;
  /** Recomputed on every entry change; presentation only (ADR-0004). */
  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

export type SudokuPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  /**
   * A relative move, clamped per axis. `Home`/`End` are this action with
   * `columns: ∓8` — a full-width clamped move lands on the row's first or
   * last column by construction, so they need no action of their own.
   */
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "enter-digit"; readonly digit: SudokuDigit }
  | { readonly type: "clear-cell" }
  | { readonly type: "use-hint"; readonly solution: readonly SudokuDigit[] }
  | { readonly type: "mark-synced" };

/**
 * The deterministic server snapshot: givens only, 00:00, `hydrated: false`,
 * and NO caret — it appears on first interaction, so the first paint
 * carries no state the record might contradict.
 *
 * Takes `DailySudokuResponse`, never the union: `daily.givens` on the
 * union is a binairo grid or a sudoku one, and neither component may
 * narrow it internally.
 */
export function initSudokuPlayState(
  daily: DailySudokuResponse,
): SudokuPlayState {
  const givens: SudokuGrid = daily.givens;
  const entries: readonly SudokuCellValue[] = givens.map(() => null);
  const derived = derive(givens, entries);
  return {
    date: daily.date,
    givens,
    entries: derived.entries,
    selected: null,
    tier: daily.tier,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
    violating: derived.violating,
    status: derived.status,
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function sudokuPlayReducer(
  state: SudokuPlayState,
  action: SudokuPlayAction,
): SudokuPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "select":
      // The SAME state when the caret does not move, exactly like
      // `clear-cell` below — and here it is load-bearing rather than a
      // saving: focus is what dispatches `select` (board.tsx), while the
      // roving-focus layout effect focuses `selected` after every change,
      // so the two would otherwise trade a render on every arrow key.
      return state.selected === action.index
        ? state
        : { ...state, selected: action.index };

    case "move-selection":
      return { ...state, selected: moved(state.selected, action) };

    case "enter-digit": {
      const current = playableValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return state;
      }
      // Re-entering the same digit clears it: a one-tap undo, mirroring
      // Binairo's "re-tapping clears", which is what lets a
      // player back out of a mistake without reaching for `apagar`.
      return withEntry(
        state,
        state.selected,
        current === action.digit ? null : action.digit,
      );
    }

    case "clear-cell": {
      const current = playableValue(state, state.selected);
      if (
        current === null ||
        current === undefined ||
        state.selected === null
      ) {
        // Already empty, a given, or nothing selected: returning the SAME
        // state matters — a new object would re-render the board and fire
        // the persist effect for a write that changed nothing.
        return state;
      }
      return withEntry(state, state.selected, null);
    }

    case "use-hint": {
      if (state.hint.used >= state.hint.free || state.status !== "playing") {
        return state;
      }
      const hint = nextHint(
        action.solution,
        playableGivens(state.givens),
        state.entries,
      );
      if (hint === null) {
        // Nothing left to reveal: never spend the free hint on a no-op.
        return state;
      }
      // `selected` is deliberately UNTOUCHED: the caret is the
      // player's and the highlight is the app's. Moving it would make the
      // hinted cell always also the selected cell, and the `hint-filled`
      // state — the one visual payload the free hint has — could never
      // render on its own.
      const revealed = withEntry(state, hint.index, hint.value);
      return {
        ...revealed,
        hint: { free: 1, used: state.hint.used + 1, lastIndex: hint.index },
      };
    }

    case "tick":
    case "pause":
    case "resume":
      // Both idempotence guards live in `play/timer.ts`, and it returns the
      // SAME timer object whenever the clock does not move — which is what
      // keeps `timer` out of the persist effect's re-runs.
      // `now` always moves, so this is always a new state.
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };

    case "mark-synced":
      return state.pendingSync ? { ...state, pendingSync: false } : state;
  }
}

/**
 * The player's current value at `index`, or `undefined` when the cell is
 * not theirs to change (a given, or out of range). Returning `undefined`
 * rather than throwing keeps a stray index a no-op — which is exactly what
 * a hand-edited `selected` or a pointer event on a gutter must be.
 */
function playableValue(
  state: SudokuPlayState,
  index: number | null,
): SudokuCellValue | undefined {
  if (index === null) {
    return undefined;
  }
  const given = state.givens[index];
  if (given === undefined || given !== 0) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

/**
 * The caret after a relative move. Clamped per axis and DELIBERATELY NOT
 * WRAPPING: wrapping from column 9 to column 1 of the next row is
 * disorienting on a boxed grid, where clamping makes the edges
 * discoverable. From no selection at all, any move lands on the first cell.
 */
function moved(
  selected: number | null,
  move: { readonly rows: number; readonly columns: number },
): number {
  if (selected === null) {
    return 0;
  }
  const row = clamp(Math.floor(selected / SIDE) + move.rows);
  const column = clamp((selected % SIDE) + move.columns);
  return row * SIDE + column;
}

function clamp(value: number): number {
  return Math.min(Math.max(value, 0), SIDE - 1);
}

interface DerivedEntries {
  readonly entries: readonly SudokuCellValue[];
  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

/**
 * Recompute everything that follows from the entries. Measured at 0.009 ms
 * for the conflicts and 0.010 ms for the verdict on a full grid, so
 * this runs synchronously on every keystroke: no debounce, no worker.
 *
 * `status` is exact, not approximate: `isSudokuSolved` is complete AND
 * conflict-free in one call, and the daily is uniquely solvable by
 * construction (`countSudokuSolutions(givens, 2) === 1` is proved at
 * generation), so a complete conflict-free grid IS the solution. The server
 * still re-judges against the stored one — this verdict only decides what
 * the UI shows (ADR-0004: local validation is never a source of truth).
 */
function derive(
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): DerivedEntries {
  const merged = mergedGrid(givens, entries);
  return {
    entries,
    violating: new Set(getSudokuConflicts(merged)),
    status: isSudokuSolved(merged) ? "solved" : "playing",
  };
}

/**
 * Write one cell and recompute the derived fields. Entering `solved` sets
 * `pendingSync` — the paired timer freeze is the hook's `pause` dispatch,
 * because this reducer may never read a clock and an entry action
 * deliberately carries no `now`. `pause` is idempotent, so dispatching it
 * on the transition is safe whatever else fired.
 */
function withEntry(
  state: SudokuPlayState,
  index: number,
  value: SudokuCellValue,
): SudokuPlayState {
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const derived = derive(state.givens, entries);
  return {
    ...state,
    ...derived,
    pendingSync:
      derived.status === "solved" && state.status !== "solved"
        ? true
        : state.pendingSync,
  };
}

/**
 * Map a persisted record onto the state. `runningSince` stays null:
 * the mount effect derives the initial running state from
 * `document.visibilityState` and dispatches `resume` itself, rather than
 * resuming a tab the player cannot see.
 *
 * `selected` stays as it is — a caret is a session thing, never persisted.
 */
function restore(
  state: SudokuPlayState,
  record: PlayRecord | undefined,
  now: number,
): SudokuPlayState {
  if (!isSudokuRecord(record)) {
    return { ...state, now, hydrated: true };
  }
  const derived = derive(state.givens, record.entries);
  return {
    ...state,
    ...derived,
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

/**
 * The record union's sudoku member, or nothing. `readPlayRecord` already
 * discards a record whose `game` disagrees with the key it was found under,
 * so this branch is unreachable in practice — it exists
 * because the reducer takes the whole union and a 64-cell binairo `entries`
 * array must never reach an 81-cell grid.
 */
function isSudokuRecord(
  record: PlayRecord | undefined,
): record is SudokuPlayRecord {
  return record?.game === "sudoku";
}
