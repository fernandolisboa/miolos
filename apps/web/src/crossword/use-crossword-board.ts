import type { DailyCrosswordResponse } from "@miolos/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
  type Dispatch,
} from "react";

import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import { countAnswered, hintGivens } from "./grid";
import {
  crosswordPlayReducer,
  initCrosswordPlayState,
  type CrosswordDirection,
  type CrosswordPlayAction,
  type CrosswordPlayState,
} from "./state";

type CrosswordHint = Hint<string>;

export interface CrosswordBoard {
  readonly state: CrosswordPlayState;

  readonly filled: number;
  readonly total: number;

  readonly hintReady: boolean;

  readonly hintKind: CrosswordHint["kind"] | null;
  readonly selectCell: (index: number) => void;

  readonly selectEntry: (index: number, direction: CrosswordDirection) => void;

  readonly toggleDirection: () => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly typeLetter: (letter: string) => void;
  readonly backspace: () => void;
  readonly revealHint: () => void;
}

export function useCrosswordBoard(
  daily: DailyCrosswordResponse,
): CrosswordBoard & { readonly dispatch: Dispatch<CrosswordPlayAction> } {
  const [state, dispatch] = useReducer(
    crosswordPlayReducer,
    daily,
    initCrosswordPlayState,
  );
  const [hintKind, setHintKind] = useState<CrosswordHint["kind"] | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { solution, entries, status } = state;

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
    const current = stateRef.current;
    if (current.hint.used >= current.hint.free || current.status === "solved") {
      return;
    }
    const hint = nextHint(
      current.solution,
      hintGivens(current.solution),
      current.entries,
    );
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint" });
  }, []);

  return {
    state,
    dispatch,
    filled,
    total,
    hintReady: state.hint.used < state.hint.free && status === "playing",
    hintKind,
    selectCell,
    selectEntry,
    toggleDirection,
    moveSelection,
    typeLetter,
    backspace,
    revealHint,
  };
}
