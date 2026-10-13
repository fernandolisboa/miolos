"use client";

import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import { useEffect, useReducer, useState } from "react";

import { messages } from "../i18n";
import { hasDecidedCell } from "../play/reset-board";
import screen from "../play/screen.module.css";
import { Board, BoardSkeleton } from "../nonogram/board";
import { Controls, ControlsSkeleton } from "../nonogram/controls";
import { countFilledCells, filledTarget } from "../nonogram/engine";
import { nonogramPageModifier } from "../nonogram/page-class";
import { initNonogramPlayState, nonogramPlayReducer } from "../nonogram/state";
import { useNonogramControls } from "../nonogram/use-nonogram-controls";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
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
      level={{ value: level, onChange: setLevel }}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
      pageModifier={nonogramPageModifier(LEVEL_SIZES[level])}
    >
      {phase.kind === "failed" ? (
        <FreePlayErrorCard onRetry={regenerate} />
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
  const {
    hintReady,
    hintKind,
    selectCell,
    moveSelection,
    enterValue,
    clearCell,
    revealHint,
    reset,
    setBrush,
    markCell,
    strokeStart,
    paintOver,
  } = useNonogramControls(state, dispatch);

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const target = filledTarget(state.clues);
  const filled = countFilledCells(state.entries);

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
      level={{ value: level, onChange: onLevelChange }}
      pageModifier={nonogramPageModifier(state.size)}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(state.size, filled, target),
          progressLong: copy.progressLong(filled, target),
          hint: {
            ready: hintReady,
            used: state.hint.used,
            explain: hintKind === null ? null : copy.hint.explain[hintKind],
            onReveal: revealHint,
          },
          onReset: hasDecidedCell(state.entries) ? reset : null,
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
          onStrokeStart={strokeStart}
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
