import { useCallback, type Dispatch } from "react";

import type { Press } from "../play/brush";
import {
  useCaretControls,
  type CaretControls,
} from "../play/use-binary-grid-controls";
import { useSettings } from "../settings/settings";
import {
  useStrokeControls,
  type StrokeControls,
} from "../play/use-stroke-controls";
import type { PlayAction } from "./state";

export interface BinairoControls extends StrokeControls, CaretControls {
  readonly tapCell: (index: number, press: Press) => void;
  readonly toggleMode: (value: 0 | 1) => void;
}

export function useBinairoControls(
  dispatch: Dispatch<PlayAction>,
): BinairoControls {
  const strokes = useStrokeControls(dispatch);
  const caret = useCaretControls(dispatch);
  const first = useSettings().games.binairo.firstValue;

  const tapCell = useCallback(
    (index: number, press: Press) => {
      dispatch({ type: "tap", index, press, first });
    },
    [dispatch, first],
  );

  const toggleMode = useCallback(
    (value: 0 | 1) => {
      dispatch({ type: "set-mode", value });
    },
    [dispatch],
  );

  return { ...strokes, ...caret, tapCell, toggleMode };
}
