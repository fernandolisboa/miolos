import type { DailyBinairoResponse } from "@miolos/core";
import { solveBinairo, type BinairoGrid } from "@miolos/games/binairo";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import { hasHintLeft, useFreeHintsPerPuzzle } from "../play/free-hints";
import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import { recordHeader, type BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  initPlayState,
  isSolvedGrid,
  playReducer,
  type CellValue,
  type PlayState,
} from "./state";
import {
  useBinairoControls,
  type BinairoControls,
} from "./use-binairo-controls";

export type BinairoHint = Hint<CellValue>;

export interface BinairoPlay extends BinairoControls {
  readonly state: PlayState;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;

  readonly hintKind: BinairoHint["kind"] | null;
  readonly revealHint: () => void;
}

export function useBinairoPlay(
  daily: DailyBinairoResponse,
  remotelyClaimed = false,
): BinairoPlay {
  const [state, dispatch] = useReducer(playReducer, daily, initPlayState);
  const [hintKind, setHintKind] = useState<BinairoHint["kind"] | null>(null);
  const allowance = useFreeHintsPerPuzzle();
  const controls = useBinairoControls(dispatch);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const { givens, entries, timer, status } = state;
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
    if (solution === null) {
      return;
    }
    const current = stateRef.current;
    if (
      !hasHintLeft(current.hint.used, allowance) ||
      current.status === "solved"
    ) {
      return;
    }

    const hint = nextHint(solution, current.givens, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution, allowance]);

  return {
    ...controls,
    state,
    elapsed,
    filled,
    hintReady:
      solution !== null &&
      hasHintLeft(hintsUsed, allowance) &&
      status === "playing",
    hintKind,
    revealHint,
  };
}

function buildRecord(
  state: PlayState,
  now: number,
  closed: boolean,
): BinairoPlayRecord {
  const merged: BinairoGrid = state.givens.map(
    (given, index) => given ?? state.entries[index] ?? null,
  );
  return {
    ...recordHeader(state, now, closed, state.hint.used),
    game: "binairo",
    entries: [...state.entries],
    grid: closed && isSolvedGrid(merged) ? [...merged] : undefined,
  };
}
