import type { DailyQueensResponse, QueensSize } from "@miolos/core";
import {
  findQueensViolations,
  isValidQueensSolution,
  solveQueens,
  type QueensBoard,
  type QueensGrid,
} from "@miolos/games/queens";

import { cycled, toggled, type Press } from "../play/brush";
import {
  binaryCellValue,
  binaryGridReducer,
  settled,
  withBinaryEntry,
  type BinaryCellValue,
  type BinaryGridAction,
  type BinaryGridRules,
  type BinaryGridState,
  type BinaryMark,
} from "../play/binary-grid";
import type { PlainHintReason } from "../play/grid-hint";
import { idleHint } from "../play/hint-state";
import { nextQueensHint } from "./hint";

export type QueensMark = BinaryMark;

export type QueensCellValue = BinaryCellValue;

export interface QueensPlayState extends BinaryGridState<PlainHintReason> {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly conflicts: ReadonlySet<number>;
}

export type QueensPlayAction =
  | BinaryGridAction
  | { readonly type: "tap"; readonly index: number; readonly press: Press }
  | { readonly type: "cross-over"; readonly index: number };

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
    selected: null,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

const QUEENS_RULES: BinaryGridRules<QueensPlayState, PlainHintReason> = {
  game: "queens",
  hint: (state) => nextQueensHint(state.solution, state.entries),
  derive(state, entries) {
    const board: QueensBoard = { size: state.size, regions: state.regions };
    const grid = queensGrid(entries);
    return {
      ...settled(state, entries, isValidQueensSolution(board, grid)),
      conflicts: new Set(findQueensViolations(board, grid)),
    };
  },
};

export function queensPlayReducer(
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
            action.press === "right" ? toggled(current, 1) : cycled(current),
            QUEENS_RULES,
          );
    }

    case "cross-over":
      return binaryCellValue(state, action.index) === null
        ? withBinaryEntry(state, action.index, 0, QUEENS_RULES)
        : state;

    default:
      return binaryGridReducer(state, action, QUEENS_RULES);
  }
}

export function queensGrid(entries: readonly QueensCellValue[]): QueensGrid {
  return entries.map((entry) => (entry === 1 ? 1 : 0));
}

export function countQueens(entries: readonly QueensCellValue[]): number {
  return entries.filter((entry) => entry === 1).length;
}
