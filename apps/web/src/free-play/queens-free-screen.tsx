"use client";

import type { QueensSize } from "@miolos/core";
import { useState } from "react";

import { messages } from "../i18n";
import screen from "../play/screen.module.css";
import { BoardSkeleton } from "../queens/board";
import { BoardPanel, queensReadouts } from "../queens/board-panel";
import styles from "../queens/queens-board.module.css";
import { useQueensBoard } from "../queens/use-queens-board";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import freePlay from "./free-play.module.css";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeQueens,
  type FreeQueensDeps,
  type FreeQueensPuzzle,
} from "./use-free-queens";

const copy = messages.games.queens.play;

const LEVEL_SIZES: Readonly<Record<FreePlayLevel, QueensSize>> = {
  leve: 7,
  medio: 8,
  dificil: 9,
};

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
      kicker={messages.games.queens.kicker}
      title={copy.title}
      rules={copy.rules}
      level={{ value: level, onChange: setLevel }}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
      pageModifier={styles.pageQueens ?? ""}
    >
      {phase.kind === "failed" ? (
        <FreePlayErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard size={LEVEL_SIZES[level]} />
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
      kicker={messages.games.queens.kicker}
      title={copy.title}
      rules={copy.rules}
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
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton
          size={size}
          regions={Array.from({ length: size * size }, () => 0)}
        />
      </div>
      <p className={freePlay.generating}>{messages.freePlay.generating}</p>
    </>
  );
}
