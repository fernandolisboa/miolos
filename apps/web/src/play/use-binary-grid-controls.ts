import { useCallback, useEffect, useRef, type Dispatch } from "react";

import {
  canHint,
  type BinaryGridAction,
  type BinaryGridState,
  type BinaryMark,
  type CaretAction,
} from "./binary-grid";
import { useFreeHintsPerPuzzle } from "./free-hints";
import type { ResetAction } from "./reset-board";
import {
  useBoardEdits,
  type BoardEdits,
  type Editable,
  type UndoAction,
} from "./undo";

export interface CaretControls {
  readonly selectCell: (index: number) => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly enterValue: (value: BinaryMark) => void;
  readonly clearCell: () => void;
}

export interface BinaryGridControls extends CaretControls {
  readonly hintReady: boolean;
  readonly revealHint: () => void;
  readonly edits: BoardEdits;
}

type CaretControlAction =
  | CaretAction
  | { readonly type: "enter-value"; readonly value: BinaryMark }
  | { readonly type: "clear-cell" };

export function useCaretControls(
  dispatch: Dispatch<CaretControlAction>,
): CaretControls {
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

  return { selectCell, moveSelection, enterValue, clearCell };
}

export function useBinaryGridControls(
  state: BinaryGridState<unknown, number> & Editable,
  dispatch: Dispatch<BinaryGridAction | ResetAction | UndoAction>,
): BinaryGridControls {
  const allowance = useFreeHintsPerPuzzle();
  const caret = useCaretControls(dispatch);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const revealHint = useCallback(() => {
    if (canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint" });
    }
  }, [dispatch, allowance]);

  const edits = useBoardEdits(state, dispatch);

  return {
    ...caret,
    hintReady: canHint(state, allowance),
    revealHint,
    edits,
  };
}
