import { useCallback, type Dispatch } from "react";

import { hasDecidedCell } from "../play/reset-board";
import { useBoardEdits, type UndoAction } from "../play/undo";
import { useSettings } from "../settings/settings";
import { hasNote } from "./notes";
import type { SudokuDigit, SudokuPlayAction, SudokuPlayState } from "./state";
import { useDigitLock } from "./use-digit-lock";

export function useSudokuInput(
  state: SudokuPlayState,
  dispatch: Dispatch<SudokuPlayAction | UndoAction>,
) {
  const { cleanNotes } = useSettings().games.sudoku;

  const selectCell = useCallback(
    (index: number) => {
      dispatch({ type: "select", index });
    },
    [dispatch],
  );

  const moveSelection = useCallback(
    (rows: number, columns: number) => {
      dispatch({ type: "move-selection", rows, columns });
    },
    [dispatch],
  );

  const enterDigit = useCallback(
    (digit: SudokuDigit) => {
      dispatch({ type: "enter-digit", digit, cleanNotes });
    },
    [dispatch, cleanNotes],
  );

  const toggleNote = useCallback(
    (digit: SudokuDigit) => {
      dispatch({ type: "toggle-note", digit });
    },
    [dispatch],
  );

  const toggleNoting = useCallback(() => {
    dispatch({ type: "toggle-noting" });
  }, [dispatch]);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, [dispatch]);

  return {
    cleanNotes,
    selectCell,
    moveSelection,
    enterDigit,
    toggleNote,
    toggleNoting,
    clearCell,
    lock: useDigitLock(state, dispatch, cleanNotes),
    edits: useBoardEdits(
      state,
      dispatch,
      hasDecidedCell(state.entries) || hasNote(state.notes),
    ),
  };
}
