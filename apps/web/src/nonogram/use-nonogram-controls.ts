import { useCallback, type Dispatch } from "react";

import type { Press } from "../play/brush";
import {
  useStrokeControls,
  type StrokeControls,
} from "../play/use-stroke-controls";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import { hintKindOf, type NonogramHintKind } from "./engine";
import type {
  NonogramBrush,
  NonogramPlayAction,
  NonogramPlayState,
} from "./state";

export interface NonogramControls
  extends BinaryGridControls<NonogramHintKind>, StrokeControls {
  readonly setBrush: (brush: NonogramBrush) => void;
  readonly markCell: (index: number, press: Press) => void;
}

export function useNonogramControls(
  state: NonogramPlayState,
  dispatch: Dispatch<NonogramPlayAction>,
): NonogramControls {
  const controls = useBinaryGridControls(state, dispatch, hintKindOf);
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
