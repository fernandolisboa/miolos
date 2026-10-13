import { useCallback, type Dispatch } from "react";

import type { Press } from "../play/brush";
import type { PaintMode, PlayAction } from "./state";

export interface BinairoControls {
  readonly tapCell: (index: number, press: Press) => void;
  readonly strokeStart: (index: number, press: Press) => void;
  readonly paintOver: (index: number) => void;
  readonly toggleMode: (mode: PaintMode) => void;
}

export function useBinairoControls(
  dispatch: Dispatch<PlayAction>,
): BinairoControls {
  const tapCell = useCallback(
    (index: number, press: Press) => {
      dispatch({ type: "tap", index, press });
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

  const toggleMode = useCallback(
    (mode: PaintMode) => {
      dispatch({ type: "set-mode", mode });
    },
    [dispatch],
  );

  return { tapCell, strokeStart, paintOver, toggleMode };
}
