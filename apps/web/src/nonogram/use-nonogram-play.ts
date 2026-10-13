import type { DailyNonogramResponse } from "@miolos/core";
import { useMemo, useReducer } from "react";

import { recordHeader, type NonogramPlayRecord } from "../play/play-record";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import { countFilledCells, filledTarget, submittedCells } from "./engine";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramPlayState,
} from "./state";
import {
  useNonogramControls,
  type NonogramControls,
} from "./use-nonogram-controls";

export interface NonogramPlay extends NonogramControls {
  readonly state: NonogramPlayState;
  readonly elapsed: number;
  readonly filled: number;
  readonly target: number;
}

export function useNonogramPlay(
  daily: DailyNonogramResponse,
  remotelyClaimed = false,
): NonogramPlay {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    daily,
    initNonogramPlayState,
  );
  const controls = useNonogramControls(state, dispatch);

  const { clues } = state;
  const target = useMemo(() => filledTarget(clues), [clues]);

  usePlayLifecycle({
    game: "nonogram",
    state,
    reduce: nonogramPlayReducer,
    dispatch,
    buildRecord,
    remotelyClaimed,
    persistDeps: [state.entries, state.hint.used],
  });

  return {
    ...controls,
    state,
    elapsed: elapsedMs(state.timer, state.now),
    filled: countFilledCells(state.entries),
    target,
  };
}

function buildRecord(
  state: NonogramPlayState,
  now: number,
  closed: boolean,
): NonogramPlayRecord {
  const submitted = closed
    ? submittedCells(state.entries, state.size ** 2)
    : null;
  return {
    ...recordHeader(state, now, closed, state.hint.used),
    game: "nonogram",
    size: state.size,
    entries: [...state.entries],
    grid: submitted === null ? undefined : [...submitted],
  };
}
