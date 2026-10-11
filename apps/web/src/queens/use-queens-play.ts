import type { DailyQueensResponse } from "@miolos/core";
import { useCallback, useReducer } from "react";

import type { Hint } from "../play/grid-hint";
import type { QueensPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  countQueens,
  initQueensPlayState,
  queensGrid,
  queensPlayReducer,
  type QueensMark,
  type QueensPlayState,
} from "./state";

export type QueensHintKind = Hint<QueensMark>["kind"];

export interface QueensPlay extends BinaryGridControls<QueensHintKind> {
  readonly state: QueensPlayState;
  readonly elapsed: number;
  readonly placed: number;
  readonly cycleCell: (index: number) => void;
  readonly crossOver: (index: number) => void;
}

export function useQueensPlay(
  daily: DailyQueensResponse,
  remotelyClaimed = false,
): QueensPlay {
  const [state, dispatch] = useReducer(
    queensPlayReducer,
    daily,
    initQueensPlayState,
  );
  const controls = useBinaryGridControls(state, dispatch, hintKindOf);

  usePlayLifecycle({
    game: "queens",
    state,
    reduce: queensPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    persistDeps: [state.entries, state.hint.used],
  });

  const cycleCell = useCallback((index: number) => {
    dispatch({ type: "cycle", index });
  }, []);

  const crossOver = useCallback((index: number) => {
    dispatch({ type: "cross-over", index });
  }, []);

  return {
    ...controls,
    state,
    elapsed: elapsedMs(state.timer, state.now),
    placed: countQueens(state.entries),
    cycleCell,
    crossOver,
  };
}

function hintKindOf(hint: Hint<QueensMark>): QueensHintKind {
  return hint.kind;
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
