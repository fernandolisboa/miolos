import type { DailyQueensResponse, QueensSize } from "@miolos/core";
import {
  findQueensViolations,
  isValidQueensSolution,
  queensAttackedCells,
  solveQueens,
  type QueensBoard,
  type QueensGrid,
} from "@miolos/games/queens";

import { claim, released, type AutoCrosses } from "../play/auto-cross";
import { cycled, toggled, type Press } from "../play/brush";
import type { PlayRecord } from "../play/play-record";
import {
  binaryCellValue,
  binaryGridReducer,
  restoreBinaryRecord,
  settled,
  withBinaryEntry,
  type BinaryCellValue,
  type BinaryGridAction,
  type BinaryGridRules,
  type BinaryGridState,
  type BinaryMark,
} from "../play/binary-grid";
import { idleHint } from "../play/hint-state";
import {
  NO_MISTAKES,
  SOLUTION_MISTAKES,
  caretPress,
  type CellPress,
  type MistakeRules,
  type MistakeState,
} from "../play/mistakes";
import {
  NO_HISTORY,
  undoable,
  type UndoAction,
  type UndoHistory,
} from "../play/undo";
import { nextQueensHint, type QueensHintReason } from "./hint";

export type QueensMark = BinaryMark;

export type QueensCellValue = BinaryCellValue;

export interface QueensPlayState extends BinaryGridState<QueensHintReason> {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly conflicts: ReadonlySet<number>;
  readonly autoCrossed: AutoCrosses;
  readonly history: UndoHistory<QueensSnapshot>;
  readonly mistakes: MistakeState;
}

type QueensSnapshot = Pick<
  QueensPlayState,
  "entries" | "conflicts" | "autoCrossed" | "selected" | "hint"
>;

export type QueensPlayAction =
  | BinaryGridAction
  | { readonly type: "tap"; readonly index: number; readonly press: Press }
  | {
      readonly type: "stroke-start";
      readonly index: number;
      readonly press: Press;
    }
  | { readonly type: "paint-over"; readonly index: number };

export function initQueensPlayState(
  daily: DailyQueensResponse,
): QueensPlayState {
  return {
    date: daily.date,
    size: daily.size,
    regions: daily.regions,
    solution: solveQueens({ size: daily.size, regions: daily.regions }),
    entries: daily.regions.map(() => null),
    conflicts: new Set(),
    autoCrossed: new Map(),
    selected: null,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
    history: NO_HISTORY,
    mistakes: NO_MISTAKES,
  };
}

export const QUEENS_MISTAKES: MistakeRules<
  QueensPlayState,
  QueensPlayAction | UndoAction
> = { ...SOLUTION_MISTAKES, press: queensPress };

function queensPress(
  { selected }: QueensPlayState,
  action: QueensPlayAction | UndoAction,
): CellPress | null {
  switch (action.type) {
    case "tap":
      return { index: action.index, held: action.press !== "right" };
    case "stroke-start":
    case "paint-over":
      return { index: action.index, held: false };
    case "enter-value":
    case "clear-cell":
      return caretPress(selected);
    default:
      return null;
  }
}

const QUEENS_RULES: BinaryGridRules<QueensPlayState, QueensHintReason> = {
  hint: (state) =>
    nextQueensHint(
      { size: state.size, regions: state.regions },
      state.solution,
      state.entries,
    ),
  derive(state, entries) {
    const board: QueensBoard = { size: state.size, regions: state.regions };
    const grid = queensGrid(entries);
    return {
      ...settled(state, entries, isValidQueensSolution(board, grid)),
      conflicts: new Set(findQueensViolations(board, grid)),
    };
  },
};

function reducerFor(autoCross: boolean) {
  return undoable(
    (state: QueensPlayState, action: QueensPlayAction): QueensPlayState => {
      const next = played(state, action);
      if (action.type === "restore") {
        return {
          ...next,
          autoCrossed: restoredAutoCrosses(next, action.record),
        };
      }
      return next.entries === state.entries
        ? next
        : withAutoCrosses(state, next, autoCross);
    },
    ({ entries, conflicts, autoCrossed, selected, hint }): QueensSnapshot => ({
      entries,
      conflicts,
      autoCrossed,
      selected,
      hint,
    }),
  );
}

export const queensPlayReducer = reducerFor(false);

export const autoCrossingReducer = reducerFor(true);

function played(
  state: QueensPlayState,
  action: QueensPlayAction,
): QueensPlayState {
  switch (action.type) {
    case "tap": {
      const current = binaryCellValue(state, action.index);
      return current === undefined
        ? state
        : withBinaryEntry(
            state,
            action.index,
            action.press === "right" ? toggled(current, 1) : cycled(current, 0),
            QUEENS_RULES,
          );
    }

    case "stroke-start":
    case "paint-over":
      return binaryCellValue(state, action.index) === null
        ? withBinaryEntry(state, action.index, 0, QUEENS_RULES)
        : state;

    case "restore":
      return restoreBinaryRecord(state, action, "queens", QUEENS_RULES);

    default:
      return binaryGridReducer(state, action, QUEENS_RULES);
  }
}

function withAutoCrosses(
  previous: QueensPlayState,
  next: QueensPlayState,
  autoCross: boolean,
): QueensPlayState {
  const entries = [...next.entries];
  const owners = released(
    previous.autoCrossed,
    entries,
    (queen) => entries[queen] === 1,
  );
  if (autoCross && next.status === "playing") {
    const placed = entries.flatMap((entry, at) =>
      entry === 1 && previous.entries[at] !== 1 ? [at] : [],
    );
    claim(
      placed.map((queen) => ({
        owner: queen,
        cells: queensAttackedCells(next, queen),
      })),
      entries,
      owners,
    );
  }
  return { ...QUEENS_RULES.derive(next, entries), autoCrossed: owners };
}

function restoredAutoCrosses(
  state: QueensPlayState,
  record: PlayRecord | undefined,
): AutoCrosses {
  const saved = record?.game === "queens" ? record.autoCrossed : undefined;
  const owners = new Map<number, ReadonlySet<number>>();
  for (const { cell, by } of saved ?? []) {
    const kept = new Set(by.filter((queen) => state.entries[queen] === 1));
    if (state.entries[cell] === 0 && kept.size > 0) {
      owners.set(cell, kept);
    }
  }
  return owners;
}

export function queensGrid(entries: readonly QueensCellValue[]): QueensGrid {
  return entries.map((entry) => (entry === 1 ? 1 : 0));
}

export function countQueens(entries: readonly QueensCellValue[]): number {
  return entries.filter((entry) => entry === 1).length;
}
