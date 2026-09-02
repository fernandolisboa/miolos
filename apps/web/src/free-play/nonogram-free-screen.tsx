"use client";

import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { messages } from "../i18n";
import screen from "../play/screen.module.css";
import { Board, BoardSkeleton } from "../nonogram/board";
import { Controls, ControlsSkeleton } from "../nonogram/controls";
import {
  countFilledCells,
  filledTarget,
  hintKindOf,
  nextNonogramHint,
  type NonogramHintKind,
} from "../nonogram/engine";
import { nonogramPageModifier } from "../nonogram/page-class";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramBrush,
  type NonogramMark,
} from "../nonogram/state";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { FreePlayChrome } from "./chrome";
import styles from "./free-play.module.css";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeNonogram,
  type FreeNonogramDeps,
  type FreeNonogramPuzzle,
} from "./use-free-nonogram";

const copy = messages.games.nonogram.play;

const LEVEL_SIZES: Readonly<Record<FreePlayLevel, NonogramSize>> = {
  leve: 5,
  medio: 10,
  dificil: 15,
};

export function NonogramFreeScreen({
  deps,
}: {
  readonly deps?: FreeNonogramDeps;
}) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const { phase, regenerate } = useFreeNonogram(level, deps);

  if (phase.kind === "ready") {
    return (
      <NonogramFreeBoard
        key={`${String(phase.puzzle.seed)}:${level}:${String(phase.run)}`}
        level={level}
        onLevelChange={setLevel}
        puzzle={phase.puzzle}
        onNext={regenerate}
      />
    );
  }

  return (
    <FreePlayChrome
      game="nonogram"
      kicker={messages.games.nonogram.kicker}
      title={copy.title}
      rules={copy.rules}
      level={level}
      onLevelChange={setLevel}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
      pageModifier={nonogramPageModifier(LEVEL_SIZES[level])}
    >
      {phase.kind === "failed" ? (
        <ErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard size={LEVEL_SIZES[level]} />
      )}
    </FreePlayChrome>
  );
}

function NonogramFreeBoard({
  level,
  onLevelChange,
  puzzle,
  onNext,
}: {
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly puzzle: FreeNonogramPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    puzzle.daily,
    initNonogramPlayState,
  );
  const [hintKind, setHintKind] = useState<NonogramHintKind | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const target = filledTarget(state.clues);
  const filled = countFilledCells(state.entries);
  const hintReady =
    state.solution !== null &&
    state.hint.used < state.hint.free &&
    state.status === "playing";

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const setBrush = useCallback((brush: NonogramBrush) => {
    dispatch({ type: "set-brush", brush });
  }, []);

  const markCell = useCallback((index: number) => {
    dispatch({ type: "mark-cell", index });
  }, []);

  const enterValue = useCallback((value: NonogramMark) => {
    dispatch({ type: "enter-value", value });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (
      current.solution === null ||
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }

    const hint = nextNonogramHint(current.solution, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hintKindOf(hint));
    dispatch({ type: "use-hint" });
  }, []);

  if (state.status === "solved" && state.solution !== null) {
    return (
      <FreePlaySolvedCard
        game="nonogram"
        level={level}
        onAgain={onNext}
        picture={{
          size: state.size,
          cells: state.solution,
          label: messages.freePlay.solved.pictureAria,
        }}
      />
    );
  }

  return (
    <FreePlayChrome
      game="nonogram"
      kicker={messages.games.nonogram.kicker}
      title={copy.title}
      rules={copy.rules}
      level={level}
      onLevelChange={onLevelChange}
      pageModifier={nonogramPageModifier(state.size)}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(state.size, filled, target),
          progressLong: copy.progressLong(filled, target),
          hint: {
            ready: hintReady,
            label: hintReady ? copy.hint.available : copy.hint.used,
            explain: hintKind === null ? null : copy.hint.explain[hintKind],
            onReveal: revealHint,
          },
        },
      }}
    >
      <div className={screen.gridCard}>
        <Board
          size={state.size}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          onSelect={selectCell}
          onMove={moveSelection}
          onMarkCell={markCell}
          onEnterValue={enterValue}
          onClear={clearCell}
          onPaintOver={paintOver}
        />
      </div>
      <Controls brush={state.brush} onSetBrush={setBrush} />
    </FreePlayChrome>
  );
}

function GeneratingBoard({ size }: { readonly size: NonogramSize }) {
  const emptyClues: NonogramClues = {
    size,
    rows: Array.from({ length: size }, () => []),
    cols: Array.from({ length: size }, () => []),
  };
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton size={size} clues={emptyClues} />
      </div>
      <ControlsSkeleton />
      <p className={styles.generating}>{messages.freePlay.generating}</p>
    </>
  );
}

function ErrorCard({ onRetry }: { readonly onRetry: () => void }) {
  return (
    <div className={styles.errorCard}>
      <p className={styles.errorTitle}>{messages.freePlay.error.title}</p>
      <p className={styles.errorBody}>{messages.freePlay.error.body}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        {messages.freePlay.error.retry}
      </button>
    </div>
  );
}
