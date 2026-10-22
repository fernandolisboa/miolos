import type { DailyBinairoResponse } from "@miolos/core";
import { solveBinairo } from "@miolos/games/binairo";
import { useCallback, useEffect, useRef } from "react";

import { canHint } from "../play/binary-grid";
import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { mistakeRecord, usePlayReducer } from "../play/mistakes";
import { recordHeader, type BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { useBoardEdits, type BoardEdits } from "../play/undo";
import {
  BINAIRO_MISTAKES,
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
  readonly edits: BoardEdits;
}

export function useBinairoPlay(
  daily: DailyBinairoResponse,
  remotelyClaimed = false,
): BinairoPlay {
  const [state, dispatch] = usePlayReducer(
    playReducer,
    daily,
    (init) => initPlayState(init, solveBinairo(init.givens)),
    BINAIRO_MISTAKES,
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
    if (canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint" });
    }
  }, [dispatch, allowance]);

  const edits = useBoardEdits(state, dispatch);

  return {
    ...controls,
    state,
    elapsed,
    filled,
    hintReady: canHint(state, allowance),
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
