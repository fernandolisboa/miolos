/**
 * The whole Binairo gameplay state machine (plan 017 §8), as one pure
 * reducer over one immutable value: no React, no DOM, no clock. Every
 * action that needs the time carries it, so the reducer stays pure and the
 * screens stay thin (D6) — most of the gameplay test surface is plain unit
 * tests.
 *
 * Two invariants hold everywhere below:
 * - `entries[i]` is always `null` where `givens[i]` is not: givens are
 *   immutable and every write path skips them.
 * - `violating` and `status` are DERIVED from the merged grid and are
 *   recomputed on every entry change, never patched incrementally.
 */
import type { DailyBinairoResponse } from "@miolos/core";
import {
  findBinairoViolations,
  isValidBinairoSolution,
  type BinairoCell,
  type BinairoGrid,
  type BinairoSolvedGrid,
} from "@miolos/games/binairo";

import { nextHint } from "../play/grid-hint";
import type { BinairoPlayRecord, PlayRecord } from "../play/play-record";
import { applyTimerAction } from "../play/timer";
import type { HintState, LifecycleAction, PlayCore } from "../play/types";

/** What a player may put in a cell. Mirrors BinairoCell; `null` = empty. */
export type CellValue = BinairoCell;

/** Sticky input mode. `cycle` is the default; the 0/1/apagar buttons toggle. */
export type PaintMode =
  | { readonly kind: "cycle" }
  | { readonly kind: "paint"; readonly value: 0 | 1 }
  | { readonly kind: "erase" };

/**
 * `status` narrows `PlayCore`'s three-member union to the two Binairo has:
 * `lost` is Termo-only (ADR-0008), and the lifecycle's terminal predicate is
 * `status !== "playing"`, which coincides with `=== "solved"` here.
 */
export interface PlayState extends PlayCore {
  readonly givens: BinairoGrid;
  /** 64 entries; always null at a given's index. */
  readonly entries: readonly CellValue[];
  readonly paint: PaintMode;
  readonly hint: HintState;
  /** Recomputed on every entry change (D11); presentation only. */
  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

export type PlayAction =
  | LifecycleAction
  | { readonly type: "tap"; readonly index: number }
  /** Drag; applies in paint/erase modes only. */
  | { readonly type: "paint-over"; readonly index: number }
  | { readonly type: "set-mode"; readonly mode: PaintMode }
  | { readonly type: "use-hint"; readonly solution: BinairoSolvedGrid }
  | { readonly type: "mark-synced" };

/**
 * The deterministic server snapshot: givens only, 00:00, hydrated: false
 * (D28). Takes `DailyBinairoResponse`, never the union (plan 018 S11) —
 * `daily.givens` on the union is `BinairoGrid | readonly (0..9)[]` and is
 * not a binairo grid.
 */
export function initPlayState(daily: DailyBinairoResponse): PlayState {
  const givens: BinairoGrid = daily.givens;
  const entries: readonly CellValue[] = givens.map(() => null);
  const derived = derive(givens, entries);
  return {
    date: daily.date,
    givens,
    entries: derived.entries,
    paint: { kind: "cycle" },
    timer: { accumulatedMs: 0, runningSince: null },
    hint: { free: 1, used: 0, lastIndex: null },
    violating: derived.violating,
    status: derived.status,
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "restore":
      return restore(state, action.record, action.now);

    case "tap": {
      const current = playableValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      return withEntry(state, action.index, tapped(state.paint, current));
    }

    case "paint-over": {
      // A drag must be idempotent over the cells it crosses, so this is a
      // plain SET, never the toggle `tap` performs. Cycling on drag is
      // chaos, so cycle mode ignores it entirely (D8).
      if (state.paint.kind === "cycle") {
        return state;
      }
      const current = playableValue(state, action.index);
      if (current === undefined) {
        return state;
      }
      const value = state.paint.kind === "erase" ? null : state.paint.value;
      return withEntry(state, action.index, value);
    }

    case "set-mode":
      return { ...state, paint: action.mode };

    case "use-hint": {
      if (state.hint.used >= state.hint.free || state.status === "solved") {
        return state;
      }
      const hint = nextHint(action.solution, state.givens, state.entries);
      if (hint === null) {
        // Nothing left to reveal: never spend the free hint on a no-op.
        return state;
      }
      const revealed = withEntry(state, hint.index, hint.value);
      return {
        ...revealed,
        hint: { free: 1, used: state.hint.used + 1, lastIndex: hint.index },
      };
    }

    case "tick":
    case "pause":
    case "resume":
      // Both idempotence guards live in `play/timer.ts` now, and it returns
      // the SAME timer object whenever the clock does not move — which is
      // what keeps `timer` out of the persist effect's re-runs (plan 018
      // §5.4). `now` always moves, so this is always a new state.
      return {
        ...state,
        timer: applyTimerAction(state.timer, action),
        now: action.now,
      };

    case "mark-synced":
      return state.pendingSync ? { ...state, pendingSync: false } : state;
  }
}

/** givens[i] ?? entries[i] — the grid the engine sees. */
export function mergedGrid(state: PlayState): BinairoGrid {
  return mergeGrid(state.givens, state.entries);
}

/**
 * Narrows a partial grid to a solved one. The engine's own `toSolvedGrid`
 * lives in internal.ts and is deliberately unexported (ADR-0019 keeps
 * `src/binairo/index.ts` the public API), so the guard lives here rather
 * than being invented as a cast at the call site.
 */
export function isSolvedGrid(grid: BinairoGrid): grid is BinairoSolvedGrid {
  return grid.every((cell) => cell !== null);
}

function mergeGrid(
  givens: BinairoGrid,
  entries: readonly CellValue[],
): BinairoGrid {
  return givens.map((given, index) => given ?? entries[index] ?? null);
}

/**
 * The player's current value at `index`, or `undefined` when the cell is
 * not theirs to change (a given, or out of range). Returning `undefined`
 * rather than throwing keeps a stray pointer event a no-op.
 */
function playableValue(state: PlayState, index: number): CellValue | undefined {
  const given = state.givens[index];
  if (given === undefined || given !== null) {
    return undefined;
  }
  return state.entries[index] ?? null;
}

/** The cell cycle, per input mode (D7/D8). */
function tapped(mode: PaintMode, current: CellValue): CellValue {
  switch (mode.kind) {
    case "cycle":
      // empty → 0 → 1 → empty (the reference frames' README, verbatim).
      return current === null ? 0 : current === 0 ? 1 : null;
    case "paint":
      // Re-tapping clears, so a stroke is undoable without leaving the mode.
      return current === mode.value ? null : mode.value;
    case "erase":
      return null;
  }
}

interface DerivedEntries {
  readonly entries: readonly CellValue[];
  readonly violating: ReadonlySet<number>;
  readonly status: "playing" | "solved";
}

/**
 * Recompute everything that follows from the entries. `status` is exact,
 * not approximate (D12): the daily is uniquely solvable by construction,
 * so a complete rule-valid grid IS the solution. The server still
 * re-judges against the stored one — this verdict only decides what the
 * UI shows (ADR-0004: local validation is never a source of truth).
 */
function derive(
  givens: BinairoGrid,
  entries: readonly CellValue[],
): DerivedEntries {
  const merged = mergeGrid(givens, entries);
  const violating = new Set<number>();
  for (const violation of findBinairoViolations(merged)) {
    for (const cell of violation.cells) {
      violating.add(cell);
    }
  }
  return {
    entries,
    violating,
    status:
      isSolvedGrid(merged) && isValidBinairoSolution(merged)
        ? "solved"
        : "playing",
  };
}

/**
 * Write one cell and recompute the derived fields. Entering `solved` sets
 * `pendingSync` — the paired timer freeze is the hook's `pause` dispatch
 * (§8.1/§8.3), because this reducer may never read a clock and `tap`
 * deliberately carries no `now`. `pause` is idempotent, so dispatching it
 * on the transition is safe whatever else fired.
 */
function withEntry(
  state: PlayState,
  index: number,
  value: CellValue,
): PlayState {
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
 * Map a persisted record onto the state (§8.3). `runningSince` stays null:
 * the mount effect derives the initial running state from
 * `document.visibilityState` and dispatches `resume` itself, rather than
 * resuming a tab the player cannot see.
 */
function restore(
  state: PlayState,
  record: PlayRecord | undefined,
  now: number,
): PlayState {
  if (!isBinairoRecord(record)) {
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
 * The record union's binairo member, or nothing. `readPlayRecord` already
 * discards a record whose `game` disagrees with the key it was found under
 * (plan 018 S17), so this branch is unreachable in practice — it exists
 * because the reducer takes the whole union and an 81-cell sudoku `entries`
 * array must never reach `derive`.
 */
function isBinairoRecord(
  record: PlayRecord | undefined,
): record is BinairoPlayRecord {
  return record?.game === "binairo";
}
