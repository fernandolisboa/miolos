import { useCallback, useEffect, useRef, useState, type Dispatch } from "react";

import {
  canHint,
  type BinaryGridAction,
  type BinaryGridState,
  type BinaryMark,
} from "./binary-grid";
import { nextBinaryHint, type Hint } from "./grid-hint";

export interface BinaryGridControls<K> {
  readonly hintReady: boolean;
  readonly hintKind: K | null;
  readonly selectCell: (index: number) => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly enterValue: (value: BinaryMark) => void;
  readonly clearCell: () => void;
  readonly revealHint: () => void;
}

export function useBinaryGridControls<K>(
  state: BinaryGridState,
  dispatch: Dispatch<BinaryGridAction>,
  kindOf: (hint: Hint<BinaryMark>) => K,
): BinaryGridControls<K> {
  const [hintKind, setHintKind] = useState<K | null>(null);

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
    const current = stateRef.current;
    const hint = canHint(current)
      ? nextBinaryHint(current.solution, current.entries)
      : null;
    if (hint === null) {
      return;
    }
    setHintKind(kindOf(hint));
    dispatch({ type: "use-hint" });
  }, [dispatch, kindOf]);

  return {
    hintReady: canHint(state),
    hintKind,
    selectCell,
    moveSelection,
    enterValue,
    clearCell,
    revealHint,
  };
}
