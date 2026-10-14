import type { DailyQueensResponse, QueensSize } from "@miolos/core";
import {
  findQueensViolations,
  isValidQueensSolution,
  queensAttackedCells,
  solveQueens,
  type QueensBoard,
  type QueensGrid,
} from "@miolos/games/queens";

import { cycled, toggled, type Press } from "../play/brush";
import type { PlayRecord } from "../play/play-record";
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
import { idleHint } from "../play/hint-state";
import { nextQueensHint, type QueensHintReason } from "./hint";

export type QueensMark = BinaryMark;

export type QueensCellValue = BinaryCellValue;

export type AutoCrosses = ReadonlyMap<number, ReadonlySet<number>>;

export interface QueensPlayState extends BinaryGridState<QueensHintReason> {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly conflicts: ReadonlySet<number>;
  readonly autoCrossed: AutoCrosses;
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
    autoCrossed: new Map(),
    selected: null,
    timer: { accumulatedMs: 0, runningSince: null },
    hint: idleHint(0),
    status: "playing",
    pendingSync: false,
    now: 0,
    hydrated: false,
  };
}

const QUEENS_RULES: BinaryGridRules<QueensPlayState, QueensHintReason> = {
  game: "queens",
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

type QueensReducer = (
  state: QueensPlayState,
  action: QueensPlayAction,
) => QueensPlayState;

function reducerFor(autoCross: boolean): QueensReducer {
  return (state, action) => {
    const next = played(state, action);
    if (action.type === "restore") {
      return { ...next, autoCrossed: restoredAutoCrosses(next, action.record) };
    }
    return next.entries === state.entries
      ? next
      : withAutoCrosses(state, next, autoCross);
  };
}

const AUTO_CROSSING = reducerFor(true);

export const queensPlayReducer = reducerFor(false);

export function queensReducer(autoCross: boolean): QueensReducer {
  return autoCross ? AUTO_CROSSING : queensPlayReducer;
}

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

function withAutoCrosses(
  previous: QueensPlayState,
  next: QueensPlayState,
  autoCross: boolean,
): QueensPlayState {
  const entries = [...next.entries];
  const owners = new Map<number, Set<number>>();
  for (const [cell, queens] of previous.autoCrossed) {
    if (entries[cell] !== 0) {
      continue;
    }
    const kept = new Set([...queens].filter((queen) => entries[queen] === 1));
    if (kept.size > 0) {
      owners.set(cell, kept);
    } else {
      entries[cell] = null;
    }
  }

  if (autoCross && next.status === "playing") {
    const board = { size: next.size, regions: next.regions };
    const placed = entries.flatMap((entry, at) =>
      entry === 1 && previous.entries[at] !== 1 ? [at] : [],
    );
    for (const queen of placed) {
      for (const cell of queensAttackedCells(board, queen)) {
        const claimed = owners.get(cell);
        if (claimed !== undefined) {
          claimed.add(queen);
        } else if (entries[cell] === null) {
          entries[cell] = 0;
          owners.set(cell, new Set([queen]));
        }
      }
    }
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
    const kept = by.filter((queen) => state.entries[queen] === 1);
    if (state.entries[cell] === 0 && kept.length > 0) {
      owners.set(cell, new Set(kept));
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
