import { useCallback, useEffect, useRef, type Dispatch } from "react";

import {
  canHint,
  type BinaryGridAction,
  type BinaryGridState,
  type BinaryMark,
} from "./binary-grid";
import { useFreeHintsPerPuzzle } from "./free-hints";
import type { ResetAction } from "./reset-board";
import {
  useBoardEdits,
  type BoardEdits,
  type Undoable,
  type UndoAction,
} from "./undo";

export interface BinaryGridControls {
  readonly hintReady: boolean;
  readonly selectCell: (index: number) => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly enterValue: (value: BinaryMark) => void;
  readonly clearCell: () => void;
  readonly revealHint: () => void;
  readonly edits: BoardEdits;
}

export function useBinaryGridControls(
  state: BinaryGridState<unknown, number> & Undoable<unknown>,
  dispatch: Dispatch<BinaryGridAction | ResetAction | UndoAction>,
): BinaryGridControls {
  const allowance = useFreeHintsPerPuzzle();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

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

  const enterValue = useCallback(
    (value: BinaryMark) => {
      dispatch({ type: "enter-value", value });
    },
    [dispatch],
  );

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, [dispatch]);

  const revealHint = useCallback(() => {
    if (canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint" });
    }
  }, [dispatch, allowance]);

  const edits = useBoardEdits(state, dispatch);

  return {
    hintReady: canHint(state, allowance),
    selectCell,
    moveSelection,
    enterValue,
    clearCell,
    revealHint,
    edits,
  };
}
