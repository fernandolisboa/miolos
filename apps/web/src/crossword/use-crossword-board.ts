import type { DailyCrosswordResponse } from "@miolos/core";
import { useCallback, useEffect, useMemo, useRef, type Dispatch } from "react";

import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { hintAllowed } from "../play/hint-allowance";
import { usePlayReducer } from "../play/mistakes";
import { useBoardEdits, type BoardEdits } from "../play/undo";
import { useSettings } from "../settings/settings";
import { countAnswered } from "./grid";
import {
  CROSSWORD_MISTAKES,
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
  readonly edits: BoardEdits;
}

export function useCrosswordBoard(
  daily: DailyCrosswordResponse,
): CrosswordBoard & { readonly dispatch: Dispatch<CrosswordPlayAction> } {
  const [state, dispatch] = usePlayReducer(
    crosswordPlayReducer,
    daily,
    initCrosswordPlayState,
    CROSSWORD_MISTAKES,
  );
  const allowance = useFreeHintsPerPuzzle();
  const { skipFilled } = useSettings().games.crossword;

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

  const selectCell = useCallback(
    (index: number) => {
      dispatch({ type: "select", index });
    },
    [dispatch],
  );

  const selectEntry = useCallback(
    (index: number, direction: CrosswordDirection) => {
      dispatch({ type: "select-entry", index, direction });
    },
    [dispatch],
  );

  const toggleDirection = useCallback(() => {
    dispatch({ type: "toggle-direction" });
  }, [dispatch]);

  const moveSelection = useCallback(
    (rows: number, columns: number) => {
      dispatch({ type: "move-selection", rows, columns });
    },
    [dispatch],
  );

  const typeLetter = useCallback(
    (letter: string) => {
      dispatch({ type: "type-letter", letter, skipFilled });
    },
    [dispatch, skipFilled],
  );

  const backspace = useCallback(() => {
    dispatch({ type: "backspace" });
  }, [dispatch]);

  const revealHint = useCallback(() => {
    if (hintAllowed(stateRef.current, allowance)) {
      dispatch({ type: "use-hint" });
    }
  }, [dispatch, allowance]);

  const edits = useBoardEdits(state, dispatch);

  return {
    state,
    dispatch,
    filled,
    total,
    hintReady: hintAllowed(state, allowance),
    selectCell,
    selectEntry,
    toggleDirection,
    moveSelection,
    typeLetter,
    backspace,
    revealHint,
    edits,
  };
}
