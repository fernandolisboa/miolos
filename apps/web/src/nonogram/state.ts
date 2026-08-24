/**
 * The whole Nonogram gameplay state machine, as one pure
 * reducer over one immutable value: no React, no DOM, no clock. Every action
 * that needs the time carries it, so the reducer stays pure and the screen
 * stays thin — most of the gameplay test surface is plain unit tests.
 *
 * The input model is BRUSH-FIRST: a sticky brush plus a gesture. A
 * Nonogram stroke carries no value of its own, so `paint-over` must be a
 * plain SET and the value it sets can only come from sticky state. There is
 * deliberately no cycle mode — `binairo/state.ts`'s `paint-over` case
 * ignores that action entirely in cycle mode, and here the drag IS the
 * primary gesture.
 */
import type { DailyNonogramResponse, NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import type { NonogramPlayRecord, PlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";
import { isPictureComplete, nextNonogramHint, solutionMarks } from "./engine";

/**
 * 1 = preenchida, 0 = marcada (crossed out).
 *
 * The `0` is FORCED, not chosen (ADR-0032). `grid-hint.ts`'s `nextHint` reads
 * `if (entry !== null && entry !== target)`, and the shared solution's empty
 * cell is `0`; if a cross were a third value distinct from it, EVERY
 * correctly-crossed cell would come back as a `correction` and the day's one
 * hint would systematically tell the player to un-cross a cell they crossed
 * correctly. The encoding works if and only if a cross ≡ the solution's
 * empty value.
 *
 * `Mark` here is the DECIDED-VALUE union — either mark, fill included — and
 * is deliberately NOT the pt-BR *marcada*, which names the cross alone
 * (`controls.cross`, CONTEXT.md's Crossed row). So `markCell` / `mark-cell` /
 * `asMark` are the game-generic write and none of them is the cross brush.
 */
export type NonogramMark = 0 | 1;

/** `null` = vazia (undecided). */
export type NonogramCellValue = NonogramMark | null;

/**
 * The sticky brush. NO cycle mode: a cycle drag is a no-op, and on
 * this board the drag is the primary gesture, so a cycle default would ship
 * the game with its main input dead on first paint.
 */
export type NonogramBrush = "fill" | "cross" | "erase";

/**
 * `status` narrows `PlayCore`'s three-member union to the two Nonogram has:
 * `lost` is Termo-only (ADR-0008), and the lifecycle's terminal predicate is
 * `status !== "playing"`, which coincides with `=== "solved"` here.
 */
export interface NonogramPlayState extends PlayCore {
  readonly size: NonogramSize;
  /** The board constant the rails render — Nonogram's `givens`. */
  readonly clues: NonogramClues;
  /**
   * The recovered picture, or null when the clues did not solve. It lives in
   * state because — unlike Sudoku and Binairo — a Nonogram has no rule-local
   * completion test: comparing against the picture is the ONLY way to know
   * the board is finished, and the reducer may not reach for a solver on
   * every action. Derived from the PUBLISHED clues, which is ADR-0027's
   * argument verbatim.
   */
  readonly solution: readonly NonogramMark[] | null;
  /** size² entries. */
  readonly entries: readonly NonogramCellValue[];
  /** The selected cell AND the roving-focus caret — one concept (ADR-0030). */
  readonly selected: number | null;
  readonly brush: NonogramBrush;
  readonly hint: HintState;
  readonly status: "playing" | "solved";
}

export type NonogramPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  /**
   * A relative move, clamped per axis. `Home`/`End` are this action with
   * `columns: ∓(size − 1)` — a full-width clamped move lands on the row's
   * first or last column by construction.
   */
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    }
  | { readonly type: "set-brush"; readonly brush: NonogramBrush }
  /** A tap or Enter/Space: applies the brush, re-applying it clears. */
  | { readonly type: "mark-cell"; readonly index: number }
  /** A keyboard write of a SPECIFIC value; re-entering the same value clears. */
  | { readonly type: "enter-value"; readonly value: NonogramMark }
  | { readonly type: "clear-cell" }
  /** A drag: an idempotent SET, never a toggle. */
  | { readonly type: "paint-over"; readonly index: number }
  /** A bare verb — the state carries the solution, unlike Sudoku's. */
  | { readonly type: "use-hint" };

/**
 * The deterministic server snapshot: an empty board, 00:00, `hydrated:
 * false`, and NO caret — it appears on first interaction, so the first paint
 * carries no state the record might contradict.
 *
 * Takes `DailyNonogramResponse`, never the union: `daily.size`
 * on the union is a binairo literal or a nonogram one, and no component may
 * narrow it internally.
 *
 * The solve runs HERE, once, in the `useReducer` initializer — 0.084 ms at
 * 15×15, on the server render too. `solutionMarks` never throws, so an
 * unsolvable clue set is a `null` the screen has a branch for, never a crash.
 */
export function initNonogramPlayState(
  daily: DailyNonogramResponse,
): NonogramPlayState {
  const size = daily.size;
  return {
    date: daily.date,
    size,
    clues: daily.clues,
    solution: solutionMarks(daily.clues),
    entries: Array.from({ length: size ** 2 }, () => null),
    selected: null,
    brush: "fill",
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function nonogramPlayReducer(
  state: NonogramPlayState,
  action: NonogramPlayAction,
): NonogramPlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "select":
      // An OFF-BOARD index is refused, exactly as every writing case refuses
      // one. `selected` was the only field on this state that could hold a
      // value outside `0..size²-1`, and the
      // failure it produces is not graceful: `board.tsx` computes
      // `tabbable = selected ?? 0`, so an out-of-range caret matches no cell
      // and the composite widget loses its single roving tab stop entirely —
      // ADR-0030's "exactly one cell is ever tabbable" becomes zero, and the
      // board is unreachable by keyboard. Unreachable today (both dispatchers
      // carry a real index); this makes the invariant structural rather than
      // dependent on every future dispatcher being well behaved.
      if (cellValue(state, action.index) === undefined) {
        return state;
      }
      // The SAME state when the caret does not move. Load-bearing rather
      // than a saving: `onFocus` dispatches `select` while the roving-focus
      // layout effect focuses `selected`, so without the bail-out the two
      // trade a render on every arrow key.
      return state.selected === action.index
        ? state
        : { ...state, selected: action.index };

    case "move-selection": {
      // The SAME state when the caret cannot move — the guard above, for the
      // input that actually produces it. `moved` clamps per axis, so an arrow
      // held against an edge, or `Home` on column 0, hands back the index it
      // was given; without this every one of those repeats allocates a state
      // and re-renders the screen for a caret that did not move.
      const next = moved(state.selected, action, state.size);
      return state.selected === next ? state : { ...state, selected: next };
    }

    case "set-brush":
      // Pressing the active brush is a no-op returning the SAME state: there
      // is no cycle to fall back to.
      return state.brush === action.brush
        ? state
        : { ...state, brush: action.brush };

    case "mark-cell": {
      const current = cellValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      // Re-applying the brush's own value clears it: a one-tap undo,
      // mirroring Binairo's "re-tapping clears" and `sudoku/state.ts`'s
      // `enter-digit`.
      const value = brushValue(state.brush);
      return withEntry(state, action.index, current === value ? null : value);
    }

    case "enter-value": {
      const current = cellValue(state, state.selected);
      if (current === undefined || state.selected === null) {
        return state;
      }
      // The keyboard's own door: `1` and `2` write either value WITHOUT
      // touching the brush, and re-entering the same value clears.
      return withEntry(
        state,
        state.selected,
        current === action.value ? null : action.value,
      );
    }

    case "clear-cell": {
      const current = cellValue(state, state.selected);
      if (
        current === null ||
        current === undefined ||
        state.selected === null
      ) {
        // Already empty or nothing selected: returning the SAME state matters
        // — a new object would re-render the board and fire the persist
        // effect for a write that changed nothing.
        return state;
      }
      return withEntry(state, state.selected, null);
    }

    case "paint-over": {
      // A plain SET, never a toggle: a drag must be idempotent over the cells
      // it crosses (`binairo/state.ts`'s `paint-over` case).
      const current = cellValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      return withEntry(state, action.index, brushValue(state.brush));
    }

    case "use-hint": {
      if (
        state.hint.used >= state.hint.free ||
        state.status !== "playing" ||
        state.solution === null
      ) {
        return state;
      }
      const hint = nextNonogramHint(state.solution, state.entries);
      if (hint === null) {
        // Nothing left to reveal: never spend the free hint on a no-op.
        return state;
      }
      // `selected` is deliberately UNTOUCHED: the caret is the player's and
      // the highlight is the app's. Moving it would make the hinted cell
      // always also the selected cell, and `.cellHinted` — the one visual
      // payload the free hint has — could never render on its own.
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
      // keeps `timer` out of the persist effect's re-runs. `now` always
      // moves, so this is always a new state.
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };
  }
}

/**
 * The value a brush writes. `erase` writes `null`; the two marking brushes
 * write their own mark. There is no `violating` set and no error colour on
 * this board, deliberately: a Nonogram has no local rule, so the
 * only cheap per-cell check is against the SOLUTION — and rendering that is
 * a per-cell oracle (paint a cell, watch it turn red, brute-force the
 * picture). The stuck player's escape hatch is the hint's correction branch.
 */
function brushValue(brush: NonogramBrush): NonogramCellValue {
  switch (brush) {
    case "fill":
      return 1;
    case "cross":
      return 0;
    case "erase":
      return null;
  }
}

/**
 * The player's current value at `index`, or `undefined` when the index is
 * not on the board. A Nonogram has no givens, so every in-range cell is
 * theirs; returning `undefined` rather than throwing keeps a stray pointer
 * event or a hand-edited `selected` a no-op rather than a write.
 *
 * `Number.isInteger` rather than a bare range test: `NaN < 0` and
 * `NaN >= length` are BOTH false, so a `NaN` index walked straight through a
 * comparison-only guard and came back as `entries[NaN] ?? null` — a legal
 * `null` cell value, i.e. "an undecided cell at an index that does not
 * exist". `1.5` had the same shape. This is the one bounds check every
 * writing case and `select` share, so it is the right place to close both.
 */
function cellValue(
  state: NonogramPlayState,
  index: number | null,
): NonogramCellValue | undefined {
  if (
    index === null ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= state.entries.length
  ) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

/**
 * The caret after a relative move. Clamped per axis and DELIBERATELY NOT
 * WRAPPING: wrapping from the last column to the first of the next row is
 * disorienting on a ruled grid, where clamping makes the edges discoverable.
 * From no selection at all, any move lands on the first cell.
 *
 * `size` comes from the STATE, never from a module constant: this board is 5,
 * 8, 10 or 15 a side depending on the weekday.
 */
function moved(
  selected: number | null,
  move: { readonly rows: number; readonly columns: number },
  size: number,
): number {
  if (selected === null) {
    return 0;
  }
  const row = clamp(Math.floor(selected / size) + move.rows, size);
  const column = clamp((selected % size) + move.columns, size);
  return row * size + column;
}

function clamp(value: number, size: number): number {
  return Math.min(Math.max(value, 0), size - 1);
}

/**
 * Write one cell and recompute `status`. Entering `solved` sets
 * `pendingSync` — the paired timer freeze is the hook's `pause` dispatch,
 * because this reducer may never read a clock and an entry action
 * deliberately carries no `now`.
 *
 * A CLOSED BOARD TAKES NO WRITE, and that guard lives here rather than in the
 * four entry cases so a future action inherits it. The window it closes is one
 * commit wide and this board is the one that can fall into it: the freeze
 * above is an EFFECT, so between the commit that sets `status: "solved"` and
 * the flush that pauses the clock the play screen is still mounted
 * (`nonogram-screen.tsx` swaps to the conclusion only on `solved` AND
 * `runningSince === null`) and still handling `pointermove`.
 *
 * The identity guard is NEW in this game, and it is required rather than an
 * optimisation: a drag dispatches `paint-over` per `pointermove`, and the
 * caller cannot bail because it does not cheaply know the current value.
 * Sudoku's and Binairo's `withEntry` allocate a new `entries` array
 * unconditionally — at 225 cells that is a fresh array and a persist-effect
 * run per move event. Binairo's absence of this guard is a latent
 * inefficiency filed as #62, not fixed here.
 *
 * Writing the HINTED cell drops the hint ring, and that is what makes the
 * stylesheet's claim true: `.cellHinted` ships as two rules
 * (`.cellFilled.cellHinted`, `.cellCrossed.cellHinted`) and no bare one, so
 * the class may only ever land on a cell that still holds ink. Without this
 * the ring would survive the player erasing the cell — a class matching no
 * rule — or, worse, survive the player crossing a cell the app FILLED, where
 * the ring would go on claiming "the app placed this" over the player's own
 * mark. The identity guard above means re-writing the same value is not a
 * write at all, so the ring survives that.
 */
function withEntry(
  state: NonogramPlayState,
  index: number,
  value: NonogramCellValue,
): NonogramPlayState {
  if (state.status !== "playing") {
    return state;
  }
  if ((state.entries[index] ?? null) === value) {
    return state;
  }
  const entries = state.entries.map((entry, at) =>
    at === index ? value : entry,
  );
  const written = derive(state, entries);
  return state.hint.lastIndex === index
    ? { ...written, hint: { ...written.hint, lastIndex: null } }
    : written;
}

/**
 * Everything that follows from the entries. `status` is the ONLY derived
 * field: there is no rule-local verdict to compute, so completion is the
 * picture comparison and nothing else.
 *
 * The server still re-judges against the stored row — this verdict only
 * decides what the UI shows (ADR-0004: local validation is never a source of
 * truth). With `solution === null` the board can never close, which is
 * correct: the screen renders the unavailable card instead.
 */
function derive(
  state: NonogramPlayState,
  entries: readonly NonogramCellValue[],
): NonogramPlayState {
  const status =
    state.solution !== null && isPictureComplete(state.solution, entries)
      ? "solved"
      : "playing";
  return {
    ...state,
    entries,
    status,
    pendingSync:
      status === "solved" && state.status !== "solved"
        ? true
        : state.pendingSync,
  };
}

/**
 * Map a persisted record onto the state. `runningSince` stays null: the
 * mount effect derives the initial running state from
 * `document.visibilityState` and dispatches `resume` itself, rather than
 * resuming a tab the player cannot see.
 *
 * `selected` stays as it is — a caret is a session thing, never persisted.
 *
 * A record whose `size` or `entries.length` disagrees with TODAY's board is
 * DISCARDED, never migrated. `readPlayRecord` proves the record
 * addresses its own key and the schema proves `entries.length === size²` for
 * the record's OWN size — only this compares it against today's, and it is
 * the ONLY thing that does.
 *
 * WHAT IT IS DEFENDING AGAINST is the hand-edited or corrupted store, the
 * same class as `isNonogramRecord` below — NOT an ordinary day rollover.
 * Records are keyed `miolos:play:<game>:<date>` and the mount effect reads
 * `readPlayRecord(game, date)` with the SERVER's date, so yesterday's record
 * lives at a different key; and a nonogram's size is a pure function of the
 * weekday, so a same-date record always carries today's size. No product path
 * reaches this branch, which is why the suite has to hand-build the record it
 * reproduces the hazard with (`nonogram-state.test.ts`, the size-15 record
 * under a Monday state).
 *
 * The damage a mismatched array WOULD do is the LONG direction:
 * `isPictureComplete` iterates the solution (`engine.ts`), so a 225-cell array
 * reaching `derive` on a 25-cell board reads as COMPLETE the moment its first
 * 25 cells happen to paint today's picture — `status` flips to `"solved"` on
 * a board the player never touched and `pendingSync` latches a completion the
 * queue then POSTs. The short direction is a false win too, on four shipped
 * motif variants (see `isPictureComplete`'s TSDoc). Both are discarded here.
 */
function restore(
  state: NonogramPlayState,
  record: PlayRecord | undefined,
  now: number,
): NonogramPlayState {
  if (
    !isNonogramRecord(record) ||
    record.size !== state.size ||
    record.entries.length !== state.entries.length
  ) {
    return { ...state, now, hydrated: true };
  }
  const derived = derive(state, record.entries);
  return {
    ...derived,
    timer: { accumulatedMs: record.elapsedMs, runningSince: null },
    hint: { free: 1, used: record.hintsUsed, lastIndex: null },
    pendingSync: record.pendingSync,
    now,
    hydrated: true,
  };
}

/**
 * The record union's nonogram member, or nothing. `readPlayRecord` already
 * discards a record that does not address the key it was found under — `game`
 * and `date` both — so this branch is unreachable in practice:
 * it exists because the reducer takes the whole union and a 64-cell binairo
 * `entries` array must never reach a nonogram board.
 */
function isNonogramRecord(
  record: PlayRecord | undefined,
): record is NonogramPlayRecord {
  return record?.game === "nonogram";
}
