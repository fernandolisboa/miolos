import type { DailyNonogramResponse } from "@miolos/core";
import { useCallback, useMemo, useReducer } from "react";

import type { NonogramPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  countFilledCells,
  filledTarget,
  hintKindOf,
  submittedCells,
  type NonogramHintKind,
} from "./engine";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramBrush,
  type NonogramPlayState,
} from "./state";

export interface NonogramPlay extends BinaryGridControls<NonogramHintKind> {
  readonly state: NonogramPlayState;
  readonly elapsed: number;
  readonly filled: number;
  readonly target: number;
  readonly setBrush: (brush: NonogramBrush) => void;
  readonly markCell: (index: number) => void;
  readonly paintOver: (index: number) => void;
}

export function useNonogramPlay(
  daily: DailyNonogramResponse,
  remotelyClaimed = false,
): NonogramPlay {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    daily,
    initNonogramPlayState,
  );
  const controls = useBinaryGridControls(state, dispatch, hintKindOf);

  const { clues } = state;
  const target = useMemo(() => filledTarget(clues), [clues]);

  usePlayLifecycle({
    game: "nonogram",
    state,
    reduce: nonogramPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    persistDeps: [state.entries, state.hint.used],
  });

  const setBrush = useCallback((brush: NonogramBrush) => {
    dispatch({ type: "set-brush", brush });
  }, []);

  const markCell = useCallback((index: number) => {
    dispatch({ type: "mark-cell", index });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  return {
    ...controls,
    state,
    elapsed: elapsedMs(state.timer, state.now),
    filled: countFilledCells(state.entries),
    target,
    setBrush,
    markCell,
    paintOver,
  };
}

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
