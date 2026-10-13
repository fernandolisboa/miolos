import { FREE_HINTS_PER_PUZZLE, type DailySudokuResponse } from "@miolos/core";
import { useCallback, useMemo, useReducer } from "react";

import { recordHeader, type SudokuPlayRecord } from "../play/play-record";
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

export interface SudokuPlay {
  readonly state: SudokuPlayState;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;
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
    if (solution !== null) {
      dispatch({ type: "use-hint", solution });
    }
  }, [solution]);

  return {
    state,
    elapsed,
    filled,
    hintReady:
      solution !== null &&
      hintsUsed < FREE_HINTS_PER_PUZZLE &&
      status === "playing",
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
    ...recordHeader(state, now, closed, state.hint.used),
    game: "sudoku",
    entries: [...state.entries],
    grid: solved === null ? undefined : [...solved],
  };
}
