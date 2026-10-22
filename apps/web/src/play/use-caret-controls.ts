import { useCallback, type Dispatch } from "react";

import type { BinaryMark } from "./binary-grid";
import type { CaretWriteAction } from "./grid-selection";

export interface CaretControls {
  readonly selectCell: (index: number) => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly enterValue: (value: BinaryMark) => void;
  readonly clearCell: () => void;
}

export function useCaretControls(
  dispatch: Dispatch<CaretWriteAction<BinaryMark>>,
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
