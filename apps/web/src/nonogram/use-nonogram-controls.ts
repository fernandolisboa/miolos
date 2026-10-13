import { useCallback, type Dispatch } from "react";

import type { Press } from "../play/brush";
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

export interface NonogramControls extends BinaryGridControls<NonogramHintKind> {
  readonly setBrush: (brush: NonogramBrush) => void;
  readonly markCell: (index: number, press: Press) => void;
  readonly strokeStart: (index: number, press: Press) => void;
  readonly paintOver: (index: number) => void;
}

export function useNonogramControls(
  state: NonogramPlayState,
  dispatch: Dispatch<NonogramPlayAction>,
): NonogramControls {
  const controls = useBinaryGridControls(state, dispatch, hintKindOf);

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

  const strokeStart = useCallback(
    (index: number, press: Press) => {
      dispatch({ type: "stroke-start", index, press });
    },
    [dispatch],
  );

  const paintOver = useCallback(
    (index: number) => {
      dispatch({ type: "paint-over", index });
    },
    [dispatch],
  );

  return { ...controls, setBrush, markCell, strokeStart, paintOver };
}
