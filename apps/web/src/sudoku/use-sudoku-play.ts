import type { DailySudokuResponse } from "@miolos/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import type { SudokuPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  mergedGrid,
  playableGivens,
  solutionDigits,
  solvedDigits,
} from "./engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayState,
} from "./state";

export type SudokuHint = Hint<SudokuDigit>;

export interface SudokuPlay {
  readonly state: SudokuPlayState;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;

  readonly hintKind: SudokuHint["kind"] | null;
  readonly selectCell: (index: number) => void;

  readonly moveSelection: (rows: number, columns: number) => void;

  readonly enterDigit: (digit: SudokuDigit) => void;
  readonly clearCell: () => void;
  readonly revealHint: () => void;
}

export function useSudokuPlay(
  daily: DailySudokuResponse,
  remotelyClaimed = false,
): SudokuPlay {
  const [state, dispatch] = useReducer(
    sudokuPlayReducer,
    daily,
    initSudokuPlayState,
  );
  const [hintKind, setHintKind] = useState<SudokuHint["kind"] | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { givens, entries, timer, status } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);

  const playable = useMemo(() => playableGivens(givens), [givens]);
  const filled = countFilled(playable, entries);

  const solution = useMemo(() => solutionDigits(givens), [givens]);

  usePlayLifecycle({
    game: "sudoku",
    state,
    reduce: sudokuPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [givens, entries, hintsUsed],
  });

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const enterDigit = useCallback((digit: SudokuDigit) => {
    dispatch({ type: "enter-digit", digit });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const revealHint = useCallback(() => {
    if (solution === null) {
      return;
    }
    const current = stateRef.current;
    if (
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }

    const hint = nextHint(
      solution,
      playableGivens(current.givens),
      current.entries,
    );
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution]);

  return {
    state,
    elapsed,
    filled,
    hintReady:
      solution !== null && hintsUsed < state.hint.free && status === "playing",
    hintKind,
    selectCell,
    moveSelection,
    enterDigit,
    clearCell,
    revealHint,
  };
}

function buildRecord(
  state: SudokuPlayState,
  now: number,
  closed: boolean,
): SudokuPlayRecord {
  const solved = closed
    ? solvedDigits(mergedGrid(state.givens, state.entries))
    : null;
  return {
    v: 1,
    game: "sudoku",
    date: state.date,
    entries: [...state.entries],
    grid: solved === null ? undefined : [...solved],
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
