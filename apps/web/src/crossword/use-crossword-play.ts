import type { DailyCrosswordResponse } from "@miolos/core";

import type { CrosswordPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { crosswordPlayReducer, type CrosswordPlayState } from "./state";
import { useCrosswordBoard, type CrosswordBoard } from "./use-crossword-board";

export interface CrosswordPlay extends CrosswordBoard {
  readonly elapsed: number;
}

export function useCrosswordPlay(
  daily: DailyCrosswordResponse,
  remotelyClaimed = false,
): CrosswordPlay {
  const { dispatch, ...board } = useCrosswordBoard(daily);
  const { state } = board;

  usePlayLifecycle({
    game: "crossword",
    state,
    reduce: crosswordPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [state.solution, state.entries, state.hint.used],
  });

  return { ...board, elapsed: elapsedMs(state.timer, state.now) };
}

function buildRecord(
  state: CrosswordPlayState,
  now: number,
  closed: boolean,
): CrosswordPlayRecord {
  return {
    v: 1,
    game: "crossword",
    date: state.date,
    entries: [...state.entries],
    grid: closed && state.status === "solved" ? [...state.solution] : undefined,
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
