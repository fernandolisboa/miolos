import { useCallback, type Dispatch } from "react";

import type { Press } from "./brush";

export type StrokeAction =
  | {
      readonly type: "stroke-start";
      readonly index: number;
      readonly press: Press;
    }
  | { readonly type: "paint-over"; readonly index: number };

export interface StrokeControls {
  readonly strokeStart: (index: number, press: Press) => void;
  readonly paintOver: (index: number) => void;
}

export function useStrokeControls(
  dispatch: Dispatch<StrokeAction>,
): StrokeControls {
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

  return { strokeStart, paintOver };
}
