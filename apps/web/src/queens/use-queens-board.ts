import type { DailyQueensResponse } from "@miolos/core";
import { useCallback, useReducer, type Dispatch } from "react";

import type { Press } from "../play/brush";
import type { Hint } from "../play/grid-hint";
import {
  useBinaryGridControls,
  type BinaryGridControls,
} from "../play/use-binary-grid-controls";
import {
  countQueens,
  initQueensPlayState,
  queensPlayReducer,
  type QueensMark,
  type QueensPlayAction,
  type QueensPlayState,
} from "./state";

export type QueensHintKind = Hint<QueensMark>["kind"];

export interface QueensBoardState extends BinaryGridControls<QueensHintKind> {
  readonly state: QueensPlayState;
  readonly dispatch: Dispatch<QueensPlayAction>;
  readonly placed: number;
  readonly tapCell: (index: number, press: Press) => void;
  readonly crossOver: (index: number) => void;
}

export function useQueensBoard(daily: DailyQueensResponse): QueensBoardState {
  const [state, dispatch] = useReducer(
    queensPlayReducer,
    daily,
    initQueensPlayState,
  );
  const controls = useBinaryGridControls(state, dispatch, hintKindOf);

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

function hintKindOf(hint: Hint<QueensMark>): QueensHintKind {
  return hint.kind;
}
