import type { DailyQueensResponse } from "@miolos/core";

import type { QueensPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { queensGrid, queensPlayReducer, type QueensPlayState } from "./state";
import { useQueensBoard, type QueensBoardState } from "./use-queens-board";

export interface QueensPlay extends QueensBoardState {
  readonly elapsed: number;
}

export function useQueensPlay(
  daily: DailyQueensResponse,
  remotelyClaimed = false,
): QueensPlay {
  const board = useQueensBoard(daily);
  const { state, dispatch } = board;

  usePlayLifecycle({
    game: "queens",
    state,
    reduce: queensPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    persistDeps: [state.entries, state.hint.used],
  });

  return { ...board, elapsed: elapsedMs(state.timer, state.now) };
}

function buildRecord(
  state: QueensPlayState,
  now: number,
  closed: boolean,
): QueensPlayRecord {
  return {
    v: 1,
    game: "queens",
    date: state.date,
    size: state.size,
    entries: [...state.entries],
    grid: closed ? [...queensGrid(state.entries)] : undefined,
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
