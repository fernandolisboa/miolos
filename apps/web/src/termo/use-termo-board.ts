import { deriveKeyboardState } from "@miolos/games/termo";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
} from "react";

import { initTermoPlayState, type TermoPlayReducer } from "./state";
import type {
  TermoJudge,
  TermoPlay,
  TermoPlayAction,
  TermoPlayState,
} from "./types";

export function useTermoBoard(
  date: string,
  judge: TermoJudge,
  reduce: TermoPlayReducer,
): { readonly play: TermoPlay; readonly dispatch: Dispatch<TermoPlayAction> } {
  const [state, dispatch] = useReducer(reduce, date, initTermoPlayState);

  const stateRef = useRef<TermoPlayState>(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const arm = useCallback(
    (action: Extract<TermoPlayAction, { type: "submit" | "retry" }>) => {
      const current = stateRef.current;
      const next = reduce(current, action);
      if (next === current) {
        return;
      }
      stateRef.current = next;
      dispatch(action);

      if (next.pending !== null) {
        void Promise.resolve(judge(next, next.pending)).then(dispatch);
      }
    },
    [judge, reduce],
  );

  const type = useCallback((letter: string) => {
    dispatch({ type: "type", letter });
  }, []);

  const erase = useCallback(() => {
    dispatch({ type: "erase" });
  }, []);

  const select = useCallback((slot: number) => {
    dispatch({ type: "select", slot });
  }, []);

  const submit = useCallback(() => {
    arm({ type: "submit" });
  }, [arm]);

  const retry = useCallback(() => {
    arm({ type: "retry" });
  }, [arm]);

  const keyboardState = useMemo(
    () => deriveKeyboardState(state.guesses),
    [state.guesses],
  );

  const live = state.status === "playing";

  return {
    play: {
      state,
      used: state.guesses.length,
      activeRow: live && state.pending === null ? state.guesses.length : null,
      heldRow: state.pending === null ? null : state.guesses.length,
      keyboardState,
      unavailable: state.gone,
      type,
      erase,
      select,
      submit,
      retry,
    },
    dispatch,
  };
}
