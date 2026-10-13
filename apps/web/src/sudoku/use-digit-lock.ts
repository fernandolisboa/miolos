import { useCallback, useEffect, useRef, type Dispatch } from "react";

import { useSettings } from "../settings/settings";
import type {
  DigitLockUndo,
  SudokuDigit,
  SudokuPlayAction,
  SudokuPlayState,
} from "./state";

const DOUBLE_TAP_MS = 300;

interface Tap {
  readonly digit: SudokuDigit;
  readonly at: number;
  readonly undo: DigitLockUndo | null;
}

export interface DigitLock {
  readonly enabled: boolean;
  readonly locked: SudokuDigit | null;
  readonly pressDigit: (digit: SudokuDigit, pointer: boolean) => void;
  readonly pressErase: (pointer: boolean) => void;
  readonly tapCell: (index: number) => void;
}

function undoOf(state: SudokuPlayState): DigitLockUndo | null {
  const { selected } = state;
  if (selected === null || state.givens[selected] !== 0) {
    return null;
  }
  return { index: selected, value: state.entries[selected] ?? null };
}

export function useDigitLock(
  state: SudokuPlayState,
  dispatch: Dispatch<SudokuPlayAction>,
): DigitLock {
  const enabled = useSettings().games.sudoku.lockDigit;
  const stateRef = useRef(state);
  const lastTap = useRef<Tap | null>(null);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    if (!enabled && state.locked !== null) {
      dispatch({ type: "unlock" });
    }
  }, [enabled, state.locked, dispatch]);

  const pressDigit = useCallback(
    (digit: SudokuDigit, pointer: boolean) => {
      if (!enabled || !pointer) {
        dispatch({ type: "enter-digit", digit });
        return;
      }
      const current = stateRef.current;
      const previous = lastTap.current;
      lastTap.current = null;

      if (current.locked === digit) {
        dispatch({ type: "unlock" });
        return;
      }
      const now = performance.now();
      if (
        current.locked === null &&
        previous?.digit === digit &&
        now - previous.at <= DOUBLE_TAP_MS
      ) {
        dispatch({ type: "lock-digit", digit, undo: previous.undo });
        return;
      }
      lastTap.current = { digit, at: now, undo: undoOf(current) };
      dispatch({ type: "enter-digit", digit });
      dispatch({ type: "unlock" });
    },
    [enabled, dispatch],
  );

  const pressErase = useCallback(
    (pointer: boolean) => {
      lastTap.current = null;
      dispatch({ type: "clear-cell" });
      if (enabled && pointer) {
        dispatch({ type: "unlock" });
      }
    },
    [enabled, dispatch],
  );

  const tapCell = useCallback(
    (index: number) => {
      lastTap.current = null;
      if (enabled) {
        dispatch({ type: "tap-cell", index });
      }
    },
    [enabled, dispatch],
  );

  return {
    enabled,
    locked: enabled ? state.locked : null,
    pressDigit,
    pressErase,
    tapCell,
  };
}
