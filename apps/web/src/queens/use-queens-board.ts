import type { DailyQueensResponse } from "@miolos/core";
import { useCallback, type Dispatch } from "react";

import type { Press } from "../play/brush";
import { usePlayReducer } from "../play/mistakes";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import {
  useStrokeControls,
  type StrokeControls,
} from "../play/use-stroke-controls";
import { useSettings } from "../settings/settings";
import {
  countQueens,
  autoCrossingReducer,
  initQueensPlayState,
  QUEENS_MISTAKES,
  queensPlayReducer,
  type QueensPlayAction,
  type QueensPlayState,
} from "./state";

export interface QueensBoardState extends BinaryGridControls, StrokeControls {
  readonly state: QueensPlayState;
  readonly dispatch: Dispatch<QueensPlayAction>;
  readonly placed: number;
  readonly tapCell: (index: number, press: Press) => void;
}

export function useQueensBoard(daily: DailyQueensResponse): QueensBoardState {
  const { autoCross } = useSettings().games.queens;
  const [state, dispatch] = usePlayReducer(
    autoCross ? autoCrossingReducer : queensPlayReducer,
    daily,
    initQueensPlayState,
    QUEENS_MISTAKES,
  );
  const controls = useBinaryGridControls(state, dispatch);
  const strokes = useStrokeControls(dispatch);

  const tapCell = useCallback(
    (index: number, press: Press) => {
      dispatch({ type: "tap", index, press });
    },
    [dispatch],
  );

  return {
    ...controls,
    ...strokes,
    state,
    dispatch,
    placed: countQueens(state.entries),
    tapCell,
  };
}
