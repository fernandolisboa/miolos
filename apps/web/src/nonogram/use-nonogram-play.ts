import type { DailyNonogramResponse } from "@miolos/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { NonogramPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  countFilledCells,
  filledTarget,
  hintKindOf,
  nextNonogramHint,
  submittedCells,
  type NonogramHintKind,
} from "./engine";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramBrush,
  type NonogramMark,
  type NonogramPlayState,
} from "./state";

export interface NonogramPlay {
  readonly state: NonogramPlayState;

  readonly elapsed: number;

  readonly filled: number;

  readonly target: number;

  readonly hintReady: boolean;

  readonly hintKind: NonogramHintKind | null;
  readonly selectCell: (index: number) => void;

  readonly moveSelection: (rows: number, columns: number) => void;
  readonly setBrush: (brush: NonogramBrush) => void;

  readonly markCell: (index: number) => void;

  readonly enterValue: (value: NonogramMark) => void;
  readonly clearCell: () => void;

  readonly paintOver: (index: number) => void;
  readonly revealHint: () => void;

  readonly pause: () => void;
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
  const [hintKind, setHintKind] = useState<NonogramHintKind | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { clues, entries, timer, status, solution } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);

  const target = useMemo(() => filledTarget(clues), [clues]);
  const filled = countFilledCells(entries);

  usePlayLifecycle({
    game: "nonogram",
    state,
    reduce: nonogramPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [state.entries, state.hint.used],
  });

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const setBrush = useCallback((brush: NonogramBrush) => {
    dispatch({ type: "set-brush", brush });
  }, []);

  const markCell = useCallback((index: number) => {
    dispatch({ type: "mark-cell", index });
  }, []);

  const enterValue = useCallback((value: NonogramMark) => {
    dispatch({ type: "enter-value", value });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (
      current.solution === null ||
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }

    const hint = nextNonogramHint(current.solution, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hintKindOf(hint));
    dispatch({ type: "use-hint" });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: "pause", now: Date.now() });
  }, []);

  return {
    state,
    elapsed,
    filled,
    target,
    hintReady:
      solution !== null && hintsUsed < state.hint.free && status === "playing",
    hintKind,
    selectCell,
    moveSelection,
    setBrush,
    markCell,
    enterValue,
    clearCell,
    paintOver,
    revealHint,
    pause,
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
