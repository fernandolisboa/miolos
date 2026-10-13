import type { DailyBinairoResponse } from "@miolos/core";
import { solveBinairo } from "@miolos/games/binairo";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { recordHeader, type BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { useReset } from "../play/use-reset";
import {
  canHint,
  initPlayState,
  isSolvedGrid,
  mergedGrid,
  playReducer,
  type PlayState,
} from "./state";
import {
  useBinairoControls,
  type BinairoControls,
} from "./use-binairo-controls";

export interface BinairoPlay extends BinairoControls {
  readonly state: PlayState;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;
  readonly revealHint: () => void;
  readonly reset: () => void;
}

export function useBinairoPlay(
  daily: DailyBinairoResponse,
  remotelyClaimed = false,
): BinairoPlay {
  const [state, dispatch] = useReducer(playReducer, daily, initPlayState);
  const allowance = useFreeHintsPerPuzzle();
  const controls = useBinairoControls(dispatch);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { givens, entries, timer } = state;
  const hintsUsed = state.hint.used;
  const elapsed = elapsedMs(timer, state.now);
  const filled = countFilled(givens, entries);

  const solution = useMemo(() => solveBinairo(givens), [givens]);

  usePlayLifecycle({
    game: "binairo",
    state,
    reduce: playReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [givens, entries, hintsUsed],
  });

  const revealHint = useCallback(() => {
    if (solution !== null && canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint", solution });
    }
  }, [solution, allowance]);

  const reset = useReset(dispatch);

  return {
    ...controls,
    state,
    elapsed,
    filled,
    hintReady: solution !== null && canHint(state, allowance),
    revealHint,
    reset,
  };
}

function buildRecord(
  state: PlayState,
  now: number,
  closed: boolean,
): BinairoPlayRecord {
  const merged = mergedGrid(state);
  return {
    ...recordHeader(state, now, closed, state.hint.used),
    game: "binairo",
    entries: [...state.entries],
    grid: closed && isSolvedGrid(merged) ? [...merged] : undefined,
  };
}
