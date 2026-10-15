import { useCallback, type Dispatch } from "react";

import type { Press } from "../play/brush";
import type { UndoAction } from "../play/undo";
import {
  useStrokeControls,
  type StrokeControls,
} from "../play/use-stroke-controls";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import type {
  NonogramBrush,
  NonogramPlayAction,
  NonogramPlayState,
} from "./state";

export interface NonogramControls extends BinaryGridControls, StrokeControls {
  readonly setBrush: (brush: NonogramBrush) => void;
  readonly markCell: (index: number, press: Press) => void;
}

export function useNonogramControls(
  state: NonogramPlayState,
  dispatch: Dispatch<NonogramPlayAction | UndoAction>,
): NonogramControls {
  const controls = useBinaryGridControls(state, dispatch);
  const strokes = useStrokeControls(dispatch);

  const setBrush = useCallback(
    (brush: NonogramBrush) => {
      dispatch({ type: "set-brush", brush });
    },
    [dispatch],
  );

  const markCell = useCallback(
    (index: number, press: Press) => {
      dispatch({ type: "mark-cell", index, press });
    },
    [dispatch],
  );

  return { ...controls, ...strokes, setBrush, markCell };
}
