"use client";

import { CROSSWORD_SIZES, type CrosswordSize } from "@miolos/core";
import { useEffect, useState } from "react";

import {
  CrosswordBoardView,
  CrosswordSkeletonBody,
  crosswordReadouts,
} from "../crossword/board-view";
import boardStyles from "../crossword/crossword-board.module.css";
import { useCrosswordBoard } from "../crossword/use-crossword-board";
import { messages } from "../i18n";
import type { FreePlayChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeCrossword,
  type FreeCrosswordDeps,
  type FreeCrosswordPuzzle,
} from "./use-free-crossword";

function sizeChoice(
  size: CrosswordSize,
  onChange: (size: CrosswordSize) => void,
): FreePlayChoice<CrosswordSize> {
  return {
    label: messages.freePlay.size.label,
    options: CROSSWORD_SIZES,
    value: size,
    optionLabel: messages.freePlay.size.option,
    optionAria: messages.freePlay.size.aria,
    onChange,
  };
}

function pageModifier(size: CrosswordSize): string {
  const base = boardStyles.pageCrossword ?? "";
  return size === 7 ? `${base} ${boardStyles.pageSize7 ?? ""}` : base;
}

export function CrosswordFreeScreen({
  deps,
}: {
  readonly deps?: FreeCrosswordDeps;
}) {
  const [size, setSize] = useState<CrosswordSize>(5);
  const { phase, regenerate } = useFreeCrossword(size, deps);

  if (phase.kind === "ready") {
    return (
      <CrosswordFreeBoard
        key={`${String(phase.puzzle.seed)}:${String(size)}:${String(phase.run)}`}
        size={size}
        onSizeChange={setSize}
        puzzle={phase.puzzle}
        onNext={regenerate}
      />
    );
  }

  return (
    <FreePlayChrome
      game="crossword"
      pageModifier={pageModifier(size)}
      choice={sizeChoice(size, setSize)}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
    >
      {phase.kind === "failed" ? (
        <FreePlayErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard size={size} />
      )}
    </FreePlayChrome>
  );
}

function CrosswordFreeBoard({
  size,
  onSizeChange,
  puzzle,
  onNext,
}: {
  readonly size: CrosswordSize;
  readonly onSizeChange: (size: CrosswordSize) => void;
  readonly puzzle: FreeCrosswordPuzzle;
  readonly onNext: () => void;
}) {
  const { dispatch, ...board } = useCrosswordBoard(puzzle.daily);

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, [dispatch]);

  if (board.state.status === "solved") {
    return (
      <FreePlaySolvedCard
        game="crossword"
        choice={messages.freePlay.size.option(size)}
        onAgain={onNext}
      />
    );
  }

  return (
    <FreePlayChrome
      game="crossword"
      pageModifier={pageModifier(size)}
      choice={sizeChoice(size, onSizeChange)}
      state={{ kind: "playing", readouts: crosswordReadouts(board) }}
    >
      <CrosswordBoardView board={board} />
    </FreePlayChrome>
  );
}

function GeneratingBoard({ size }: { readonly size: CrosswordSize }) {
  return <CrosswordSkeletonBody size={size} overlay={<GeneratingNote />} />;
}
