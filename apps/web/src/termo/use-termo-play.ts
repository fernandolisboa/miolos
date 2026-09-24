import type { DailyTermoResponse } from "@miolos/core";
import { deriveKeyboardState, type KeyboardState } from "@miolos/games/termo";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import type { TermoPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { postGuesses } from "./guess-client";
import { initTermoPlayState, termoPlayReducer } from "./state";
import type { TermoPlayAction, TermoPlayState } from "./types";

export interface TermoPlay {
  readonly state: TermoPlayState;

  readonly used: number;

  readonly activeRow: number | null;

  readonly heldRow: number | null;

  readonly keyboardState: KeyboardState;

  readonly unavailable: boolean;
  readonly type: (letter: string) => void;
  readonly erase: () => void;
  readonly submit: () => void;

  readonly retry: () => void;
}

export function useTermoPlay(
  daily: DailyTermoResponse,
  remotelyClaimed = false,
): TermoPlay {
  const [state, dispatch] = useReducer(
    termoPlayReducer,
    daily,
    initTermoPlayState,
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  usePlayLifecycle({
    game: "termo",
    state,
    reduce: termoPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [state.guesses],
  });

  const send = useCallback(async (armed: TermoPlayState) => {
    const pending = armed.pending;
    if (pending === null) {
      return;
    }

    const words = [...armed.guesses.map((row) => row.guess), pending];
    const outcome = await postGuesses(armed.date, words);

    switch (outcome.kind) {
      case "judged": {
        const tiles = outcome.tiles.at(-1);
        if (tiles === undefined || outcome.tiles.length !== words.length) {
          console.error(
            `a termo verdict carried ${String(outcome.tiles.length)} rows for ${String(words.length)} guesses; the turn is held`,
          );

          dispatch({ type: "held", reason: "server" });
          return;
        }
        dispatch({
          type: "judged",
          guess: pending,
          tiles,
          status: outcome.status,
          answer: outcome.answer,
        });
        return;
      }
      case "held":
        dispatch({ type: "held", reason: outcome.reason });
        return;
      case "rejected":
        dispatch({ type: "rejected", reason: outcome.reason });
        return;
      case "gone":
        dispatch({ type: "gone" });
        return;
    }
  }, []);

  const arm = useCallback(
    (action: Extract<TermoPlayAction, { type: "submit" | "retry" }>) => {
      const current = stateRef.current;
      const next = termoPlayReducer(current, action);
      if (next === current) {
        return;
      }
      stateRef.current = next;
      dispatch(action);

      if (next.pending !== null) {
        void send(next);
      }
    },
    [send],
  );

  const type = useCallback((letter: string) => {
    dispatch({ type: "type", letter });
  }, []);

  const erase = useCallback(() => {
    dispatch({ type: "erase" });
  }, []);

  const submit = useCallback(() => {
    arm({ type: "submit" });
  }, [arm]);

  const retry = useCallback(() => {
    arm({ type: "retry" });
  }, [arm]);

  useEffect(() => {
    const onOnline = () => {
      retry();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [retry]);

  const keyboardState = useMemo(
    () => deriveKeyboardState(state.guesses),
    [state.guesses],
  );

  const live = state.status === "playing";

  return {
    state,
    used: state.guesses.length,
    activeRow: live && state.pending === null ? state.guesses.length : null,
    heldRow: state.pending === null ? null : state.guesses.length,
    keyboardState,
    unavailable: state.gone,
    type,
    erase,
    submit,
    retry,
  };
}

function buildRecord(
  state: TermoPlayState,
  now: number,
  closed: boolean,
): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: state.date,
    guesses: state.guesses.map((row) => ({
      guess: row.guess,
      tiles: [...row.tiles],
    })),
    answer: closed ? state.answer : undefined,
    outcome: closed ? (state.status === "solved" ? "won" : "lost") : undefined,
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: 0,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
