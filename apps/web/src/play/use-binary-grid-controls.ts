import { useCallback, useEffect, useRef, type Dispatch } from "react";

import {
  canHint,
  type BinaryGridAction,
  type BinaryGridState,
} from "./binary-grid";
import { useFreeHintsPerPuzzle } from "./free-hints";
import type { ResetAction } from "./reset-board";
import { useCaretControls, type CaretControls } from "./use-caret-controls";
import {
  useBoardEdits,
  type BoardEdits,
  type Editable,
  type UndoAction,
} from "./undo";

export interface BinaryGridControls extends CaretControls {
  readonly hintReady: boolean;
  readonly revealHint: () => void;
  readonly edits: BoardEdits;
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
