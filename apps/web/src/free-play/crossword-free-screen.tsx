"use client";

import { CROSSWORD_SIZES, type CrosswordSize } from "@miolos/core";
import { useEffect, useState } from "react";

import {
  CrosswordBoardView,
  CrosswordSkeletonBody,
  crosswordReadouts,
} from "../crossword/board-view";
import { pageClassName } from "../crossword/size-classes";
import { useCrosswordBoard } from "../crossword/use-crossword-board";
import { messages } from "../i18n";
import { EndingStage } from "../play/ending-stage";
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
      pageModifier={pageClassName(size)}
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

  const choice = sizeChoice(size, onSizeChange);

  return (
    <EndingStage
      over={board.state.status === "solved"}
      won
      ending={() => (
        <FreePlaySolvedCard
          game="crossword"
          level={choice.optionLabel(choice.value)}
          onAgain={onNext}
        />
      )}
    >
      <FreePlayChrome
        game="crossword"
        pageModifier={pageClassName(size)}
        choice={choice}
        state={{ kind: "playing", readouts: crosswordReadouts(board) }}
      >
        <CrosswordBoardView board={board} />
      </FreePlayChrome>
    </EndingStage>
  );
}

function GeneratingBoard({ size }: { readonly size: CrosswordSize }) {
  return <CrosswordSkeletonBody size={size} overlay={<GeneratingNote />} />;
}
