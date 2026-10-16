import type { DailySudokuResponse } from "@miolos/core";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { recordHeader, type SudokuPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import type { BoardEdits } from "../play/undo";
import {
  mergedGrid,
  playableGivens,
  solutionDigits,
  solvedDigits,
} from "./engine";
import {
  canHint,
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayState,
} from "./state";
import { hasNote } from "./notes";
import type { DigitLock } from "./use-digit-lock";
import { useSudokuInput } from "./use-sudoku-input";

export interface SudokuPlay {
  readonly state: SudokuPlayState;
  readonly solution: readonly SudokuDigit[] | null;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;
  readonly selectCell: (index: number) => void;

  readonly moveSelection: (rows: number, columns: number) => void;

  readonly enterDigit: (digit: SudokuDigit) => void;
  readonly toggleNote: (digit: SudokuDigit) => void;
  readonly toggleNoting: () => void;
  readonly clearCell: () => void;
  readonly lock: DigitLock;
  readonly revealHint: () => void;
  readonly edits: BoardEdits;
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
  const allowance = useFreeHintsPerPuzzle();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { givens, entries, notes, timer } = state;
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

    persistDeps: [givens, entries, notes, hintsUsed],
  });

  const {
    cleanNotes,
    selectCell,
    moveSelection,
    enterDigit,
    toggleNote,
    toggleNoting,
    clearCell,
    lock,
    edits,
  } = useSudokuInput(state, dispatch);

  const revealHint = useCallback(() => {
    if (solution !== null && canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint", solution, cleanNotes });
    }
  }, [solution, allowance, cleanNotes]);

  return {
    state,
    solution,
    elapsed,
    filled,
    hintReady: solution !== null && canHint(state, allowance),
    selectCell,
    moveSelection,
    enterDigit,
    toggleNote,
    toggleNoting,
    clearCell,
    lock,
    revealHint,
    edits,
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
    notes: !closed && hasNote(state.notes) ? [...state.notes] : undefined,
    grid: solved === null ? undefined : [...solved],
  };
}
