"use client";

import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import { useEffect, useReducer, useState } from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { hasDecidedCell } from "../play/reset-board";
import { Board, BoardSkeleton } from "../nonogram/board";
import { Controls, ControlsSkeleton } from "../nonogram/controls";
import { countFilledCells, filledTarget } from "../nonogram/engine";
import { nonogramHintExplanation } from "../nonogram/hint";
import { nonogramPageModifier } from "../nonogram/page-class";
import { initNonogramPlayState, nonogramPlayReducer } from "../nonogram/state";
import { useNonogramControls } from "../nonogram/use-nonogram-controls";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { levelChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";
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
      choice={levelChoice(level, setLevel)}
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

  const choice = levelChoice(level, onLevelChange);
  if (state.status === "solved" && state.solution !== null) {
    return (
      <FreePlaySolvedCard
        game="nonogram"
        choice={choice}
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
      choice={choice}
      pageModifier={nonogramPageModifier(state.size)}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(state.size, filled, target),
          progressLong: copy.progressLong(filled, target),
          hint: {
            ready: hintReady,
            used: state.hint.used,
            explain: nonogramHintExplanation(state.size, state.hint.reason),
            onReveal: revealHint,
          },
          onReset: hasDecidedCell(state.entries) ? reset : null,
        },
      }}
    >
      <BoardCard below={<Controls brush={state.brush} onSetBrush={setBrush} />}>
        <Board
          size={state.size}
          clues={state.clues}
          solution={state.solution}
          entries={state.entries}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          spotlight={state.hint.spotlight}
          onSelect={selectCell}
          onMove={moveSelection}
          onMarkCell={markCell}
          onStrokeStart={strokeStart}
          onEnterValue={enterValue}
          onClear={clearCell}
          onPaintOver={paintOver}
        />
      </BoardCard>
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
      <BoardCard
        placeholder
        below={<ControlsSkeleton />}
        overlay={<GeneratingNote />}
      >
        <BoardSkeleton size={size} clues={emptyClues} />
      </BoardCard>
    </>
  );
}
