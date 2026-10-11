import type { DailyQueensResponse } from "@miolos/core";
import { useCallback, useReducer, type Dispatch } from "react";

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
  readonly cycleCell: (index: number) => void;
  readonly crossOver: (index: number) => void;
}

export function useQueensBoard(daily: DailyQueensResponse): QueensBoardState {
  const [state, dispatch] = useReducer(
    queensPlayReducer,
    daily,
    initQueensPlayState,
  );
  const controls = useBinaryGridControls(state, dispatch, hintKindOf);

  const cycleCell = useCallback((index: number) => {
    dispatch({ type: "cycle", index });
  }, []);

  const crossOver = useCallback((index: number) => {
    dispatch({ type: "cross-over", index });
  }, []);

  return {
    ...controls,
    state,
    dispatch,
    placed: countQueens(state.entries),
    cycleCell,
    crossOver,
  };
}

function hintKindOf(hint: Hint<QueensMark>): QueensHintKind {
  return hint.kind;
}
