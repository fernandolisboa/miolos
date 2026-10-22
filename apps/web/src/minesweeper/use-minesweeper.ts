"use client";

import { useCallback, type Dispatch } from "react";

import { useSettings } from "../settings/settings";
import type { MinesweeperMove } from "./state";

export interface MinesweeperMoves {
  readonly activate: (index: number) => void;
  readonly chord: (index: number) => void;
  readonly mark: (index: number) => void;
}

export function useMinesweeperMoves(
  dispatch: Dispatch<MinesweeperMove>,
): MinesweeperMoves {
  const { questionMarks } = useSettings().games.minesweeper;
  return {
    activate: useCallback(
      (index) => {
        dispatch({ type: "activate", index, now: Date.now() });
      },
      [dispatch],
    ),
    chord: useCallback(
      (index) => {
        dispatch({ type: "chord", index, now: Date.now() });
      },
      [dispatch],
    ),
    mark: useCallback(
      (index) => {
        dispatch({ type: "mark", index, questionMarks });
      },
      [dispatch, questionMarks],
    ),
  };
}
