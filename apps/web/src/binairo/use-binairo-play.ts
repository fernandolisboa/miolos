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

import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import type { BinairoPlayRecord } from "../play/play-record";
import { countFilled } from "../play/progress";
import { elapsedMs } from "../play/timer";
import { usePlayLifecycle } from "../play/use-play-lifecycle";
import {
  initPlayState,
  isSolvedGrid,
  playReducer,
  sameMode,
  type CellValue,
  type PaintMode,
  type PlayState,
} from "./state";

export type BinairoHint = Hint<CellValue>;

export interface BinairoPlay {
  readonly state: PlayState;

  readonly elapsed: number;

  readonly filled: number;

  readonly hintReady: boolean;

  readonly hintKind: BinairoHint["kind"] | null;
  readonly tapCell: (index: number) => void;
  readonly paintOver: (index: number) => void;

  readonly toggleMode: (mode: PaintMode) => void;
  readonly revealHint: () => void;
}

export function useBinairoPlay(
  daily: DailyBinairoResponse,
  remotelyClaimed = false,
): BinairoPlay {
  const [state, dispatch] = useReducer(playReducer, daily, initPlayState);
  const [hintKind, setHintKind] = useState<BinairoHint["kind"] | null>(null);

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

  const tapCell = useCallback((index: number) => {
    dispatch({ type: "tap", index });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const toggleMode = useCallback((mode: PaintMode) => {
    dispatch({
      type: "set-mode",
      mode: sameMode(stateRef.current.paint, mode) ? { kind: "cycle" } : mode,
    });
  }, []);

  const revealHint = useCallback(() => {
    if (solution === null) {
      return;
    }
    const current = stateRef.current;
    if (current.hint.used >= current.hint.free || current.status === "solved") {
      return;
    }

    const hint = nextHint(solution, current.givens, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution });
  }, [solution]);

  return {
    state,
    elapsed,
    filled,
    hintReady:
      solution !== null && hintsUsed < state.hint.free && status === "playing",
    hintKind,
    tapCell,
    paintOver,
    toggleMode,
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
    v: 1,
    game: "binairo",
    date: state.date,
    entries: [...state.entries],
    grid: closed && isSolvedGrid(merged) ? [...merged] : undefined,
    elapsedMs: elapsedMs(state.timer, now),
    hintsUsed: state.hint.used,
    concluded: closed,
    pendingSync: closed,
    syncOutcome: "pending",
  };
}
