import type { DailyBinairoResponse } from "@miolos/core";
import { solveBinairo } from "@miolos/games/binairo";

import { mistakeRecord, usePlayReducer } from "../play/mistakes";
import { recordHeader, type BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
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
  const controls = useBinairoControls(state, dispatch);

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

  return { ...controls, state, elapsed, filled };
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
