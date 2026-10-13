import type { DailyCrosswordResponse } from "@miolos/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  type Dispatch,
} from "react";

import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { countAnswered } from "./grid";
import {
  canHint,
  crosswordPlayReducer,
  initCrosswordPlayState,
  type CrosswordDirection,
  type CrosswordPlayAction,
  type CrosswordPlayState,
} from "./state";

export interface CrosswordBoard {
  readonly state: CrosswordPlayState;

  readonly filled: number;
  readonly total: number;

  readonly hintReady: boolean;
  readonly selectCell: (index: number) => void;

  readonly selectEntry: (index: number, direction: CrosswordDirection) => void;

  readonly toggleDirection: () => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly typeLetter: (letter: string) => void;
  readonly backspace: () => void;
  readonly revealHint: () => void;
  readonly reset: () => void;
}

export function useCrosswordBoard(
  daily: DailyCrosswordResponse,
): CrosswordBoard & { readonly dispatch: Dispatch<CrosswordPlayAction> } {
  const [state, dispatch] = useReducer(
    crosswordPlayReducer,
    daily,
    initCrosswordPlayState,
  );
  const allowance = useFreeHintsPerPuzzle();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { solution, entries } = state;

  const total = useMemo(
    () => solution.filter((cell) => cell !== null).length,
    [solution],
  );
  const filled = countAnswered(solution, entries);

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const selectEntry = useCallback(
    (index: number, direction: CrosswordDirection) => {
      dispatch({ type: "select-entry", index, direction });
    },
    [],
  );

  const toggleDirection = useCallback(() => {
    dispatch({ type: "toggle-direction" });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const typeLetter = useCallback((letter: string) => {
    dispatch({ type: "type-letter", letter });
  }, []);

  const backspace = useCallback(() => {
    dispatch({ type: "backspace" });
  }, []);

  const revealHint = useCallback(() => {
    if (canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint" });
    }
  }, [allowance]);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    dispatch,
    filled,
    total,
    hintReady: canHint(state, allowance),
    selectCell,
    selectEntry,
    toggleDirection,
    moveSelection,
    typeLetter,
    backspace,
    revealHint,
    reset,
  };
}
