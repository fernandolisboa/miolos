import type { DailyBinairoResponse } from "@miolos/core";
import { solveBinairo, type BinairoSolvedGrid } from "@miolos/games/binairo";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { mistakeRecord, usePlayReducer } from "../play/mistakes";
import { recordHeader, type BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { useBoardEdits, type BoardEdits } from "../play/undo";
import {
  binairoMistakes,
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
  readonly solution: BinairoSolvedGrid | null;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;
  readonly revealHint: () => void;
  readonly edits: BoardEdits;
}

export function useBinairoPlay(
  daily: DailyBinairoResponse,
  remotelyClaimed = false,
): BinairoPlay {
  const solution = useMemo(() => solveBinairo(daily.givens), [daily.givens]);
  const rules = useMemo(
    () => binairoMistakes(solution, daily.givens),
    [solution, daily.givens],
  );
  const [state, dispatch] = usePlayReducer(
    playReducer,
    daily,
    initPlayState,
    rules,
  );
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

  usePlayLifecycle({
    game: "binairo",
    state,
    reduce: playReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,

    persistDeps: [givens, entries, hintsUsed, state.mistakes.cells],
  });

  const revealHint = useCallback(() => {
    if (solution !== null && canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint", solution });
    }
  }, [dispatch, solution, allowance]);

  const edits = useBoardEdits(state, dispatch);

  return {
    ...controls,
    state,
    solution,
    elapsed,
    filled,
    hintReady: solution !== null && canHint(state, allowance),
    revealHint,
    edits,
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
    mistakes: mistakeRecord(state, closed),
  };
}
