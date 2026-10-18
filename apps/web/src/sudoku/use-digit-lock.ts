import { useCallback, useEffect, useRef, type Dispatch } from "react";

import { useSettings } from "../settings/settings";
import {
  shownAt,
  switchedLock,
  type DigitLockUndo,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "./state";

const DOUBLE_TAP_MS = 300;

interface Tap {
  readonly digit: SudokuDigit;
  readonly at: number;
  readonly undo: DigitLockUndo | null;
  readonly release: boolean;
}

interface CellTap {
  readonly index: number;
  readonly at: number;
  readonly shown: SudokuDigit | null;
  readonly undo: DigitLockUndo | null;
  readonly settled: boolean;
}

export interface DigitLock {
  readonly enabled: boolean;
  readonly locked: SudokuDigit | null;
  readonly pressDigit: (digit: SudokuDigit, pointer: boolean) => void;
  readonly pressErase: (pointer: boolean) => void;
  readonly tapCell: (index: number) => void;
}

function undoAt(
  state: SudokuPlayState,
  index: number | null,
): DigitLockUndo | null {
  if (index === null || state.givens[index] !== 0) {
    return null;
  }
  return { index, value: state.entries[index] ?? null, notes: state.notes };
}

export function useDigitLock(
  state: SudokuPlayState,
  dispatch: Dispatch<SudokuPlayAction>,
  cleanNotes: boolean,
): DigitLock {
  const enabled = useSettings().games.sudoku.lockDigit;
  const stateRef = useRef(state);
  const lastTap = useRef<Tap | null>(null);
  const lastCellTap = useRef<CellTap | null>(null);
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
      const current = stateRef.current;
      if (!enabled || !pointer) {
        dispatch({ type: "enter-digit", digit, cleanNotes });
        return;
      }
      const previous = lastTap.current;
      lastTap.current = null;
      lastCellTap.current = null;
      const now = performance.now();

      if (current.locked === digit) {
        lastTap.current = { digit, at: now, undo: null, release: true };
        dispatch({ type: "unlock" });
        return;
      }
      if (previous?.digit === digit && now - previous.at <= DOUBLE_TAP_MS) {
        if (previous.release) {
          lastTap.current = { ...previous, at: now };
          return;
        }
        if (current.locked === null) {
          dispatch({ type: "lock-digit", digit, undo: previous.undo });
          return;
        }
      }
      lastTap.current = {
        digit,
        at: now,
        undo: undoAt(current, current.selected),
        release: false,
      };
      dispatch({ type: "enter-digit", digit, cleanNotes, pointer: true });
      dispatch({ type: "unlock" });
    },
    [enabled, cleanNotes, dispatch],
  );

  const pressErase = useCallback(
    (pointer: boolean) => {
      lastTap.current = null;
      lastCellTap.current = null;
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
      if (!enabled) {
        return;
      }
      const current = stateRef.current;
      const previous = lastCellTap.current;
      const now = performance.now();

      const paired =
        previous?.index === index && now - previous.at <= DOUBLE_TAP_MS;
      if (paired) {
        if (previous.settled) {
          lastCellTap.current = { ...previous, at: now };
          return;
        }
        if (previous.shown !== null) {
          lastCellTap.current = { ...previous, at: now, settled: true };
          dispatch({
            type: "lock-digit",
            digit: previous.shown,
            undo: previous.undo,
          });
          if (previous.shown === current.locked) {
            dispatch({ type: "unlock" });
          }
          return;
        }
      }
      lastCellTap.current = {
        index,
        at: now,
        shown: paired ? null : shownAt(current, index),
        undo: undoAt(current, index),
        settled: switchedLock(current, index) !== null,
      };
      dispatch({ type: "tap-cell", index, cleanNotes });
    },
    [enabled, cleanNotes, dispatch],
  );

  return {
    enabled,
    locked: enabled ? state.locked : null,
    pressDigit,
    pressErase,
    tapCell,
  };
}
