import type { DailyQueensResponse } from "@miolos/core";
import { solveQueens } from "@miolos/games/queens";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { nextBinaryHint, type Hint } from "../play/grid-hint";
import type { QueensPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
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

export interface QueensPlay {
  readonly state: QueensPlayState;
  readonly elapsed: number;
  readonly placed: number;
  readonly hintReady: boolean;
  readonly hintKind: QueensHintKind | null;
  readonly selectCell: (index: number) => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly cycleCell: (index: number) => void;
  readonly crossOver: (index: number) => void;
  readonly enterValue: (value: QueensMark) => void;
  readonly clearCell: () => void;
  readonly revealHint: () => void;
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
  const [hintKind, setHintKind] = useState<QueensHintKind | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { size, regions } = state;
  const solution = useMemo(
    () => solveQueens({ size, regions }),
    [size, regions],
  );

  usePlayLifecycle({
    game: "queens",
    state,
    reduce: queensPlayReducer,
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

  const cycleCell = useCallback((index: number) => {
    dispatch({ type: "cycle", index });
  }, []);

  const crossOver = useCallback((index: number) => {
    dispatch({ type: "cross-over", index });
  }, []);

  const enterValue = useCallback((value: QueensMark) => {
    dispatch({ type: "enter-value", value });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (
      solution === null ||
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }
    const hint = nextBinaryHint(solution, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution]);

  return {
    state,
    elapsed: elapsedMs(state.timer, state.now),
    placed: countQueens(state.entries),
    hintReady:
      solution !== null &&
      state.hint.used < state.hint.free &&
      state.status === "playing",
    hintKind,
    selectCell,
    moveSelection,
    cycleCell,
    crossOver,
    enterValue,
    clearCell,
    revealHint,
  };
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
