"use client";

import type { QueensSize } from "@miolos/core";
import { QUEENS_WEEKDAY_CRITERIA } from "@miolos/games/queens";
import { useState } from "react";

import {
  BoardPanel,
  BoardPanelSkeleton,
  queensReadouts,
} from "../queens/board-panel";
import styles from "../queens/queens-board.module.css";
import { useQueensBoard } from "../queens/use-queens-board";
import {
  DEFAULT_FREE_PLAY_LEVEL,
  LEVEL_WEEKDAYS,
  type FreePlayLevel,
} from "./catalog";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeQueens,
  type FreeQueensDeps,
  type FreeQueensPuzzle,
} from "./use-free-queens";

export function QueensFreeScreen({ deps }: { readonly deps?: FreeQueensDeps }) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const { phase, regenerate } = useFreeQueens(level, deps);

  if (phase.kind === "ready") {
    return (
      <QueensFreeBoard
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
      game="queens"
      level={{ value: level, onChange: setLevel }}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
      pageModifier={styles.pageQueens ?? ""}
    >
      {phase.kind === "failed" ? (
        <FreePlayErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard
          size={QUEENS_WEEKDAY_CRITERIA[LEVEL_WEEKDAYS[level]].size}
        />
      )}
    </FreePlayChrome>
  );
}

function QueensFreeBoard({
  level,
  onLevelChange,
  puzzle,
  onNext,
}: {
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly puzzle: FreeQueensPuzzle;
  readonly onNext: () => void;
}) {
  const board = useQueensBoard(puzzle.daily);

  if (board.state.status === "solved") {
    return <FreePlaySolvedCard game="queens" level={level} onAgain={onNext} />;
  }

  return (
    <FreePlayChrome
      game="queens"
      level={{ value: level, onChange: onLevelChange }}
      pageModifier={styles.pageQueens ?? ""}
      state={{ kind: "playing", readouts: queensReadouts(board) }}
    >
      <BoardPanel board={board} />
    </FreePlayChrome>
  );
}

function GeneratingBoard({ size }: { readonly size: QueensSize }) {
  return (
    <BoardPanelSkeleton
      size={size}
      regions={Array.from({ length: size * size }, () => 0)}
      overlay={<GeneratingNote />}
    />
  );
}
