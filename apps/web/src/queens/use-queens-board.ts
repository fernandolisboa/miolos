import type { DailyQueensResponse } from "@miolos/core";
import { useCallback, useReducer, type Dispatch } from "react";

import type { Press } from "../play/brush";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import { useSettings } from "../settings/settings";
import {
  countQueens,
  initQueensPlayState,
  queensReducer,
  type QueensPlayAction,
  type QueensPlayState,
} from "./state";

export interface QueensBoardState extends BinaryGridControls {
  readonly state: QueensPlayState;
  readonly dispatch: Dispatch<QueensPlayAction>;
  readonly placed: number;
  readonly tapCell: (index: number, press: Press) => void;
  readonly crossOver: (index: number) => void;
}

export function useQueensBoard(daily: DailyQueensResponse): QueensBoardState {
  const { autoCross } = useSettings().games.queens;
  const [state, dispatch] = useReducer(
    queensReducer(autoCross),
    daily,
    initQueensPlayState,
  );
  const controls = useBinaryGridControls(state, dispatch);

  const tapCell = useCallback((index: number, press: Press) => {
    dispatch({ type: "tap", index, press });
  }, []);

  const crossOver = useCallback((index: number) => {
    dispatch({ type: "cross-over", index });
  }, []);

  return {
    ...controls,
    state,
    dispatch,
    placed: countQueens(state.entries),
    tapCell,
    crossOver,
  };
}
