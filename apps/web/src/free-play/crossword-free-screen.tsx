"use client";

import { useEffect } from "react";

import { BoardSkeleton } from "../crossword/board";
import { CrosswordBoardView, crosswordReadouts } from "../crossword/board-view";
import boardStyles from "../crossword/crossword-board.module.css";
import { KeyboardSkeleton } from "../crossword/keyboard";
import { useCrosswordBoard } from "../crossword/use-crossword-board";
import { messages } from "../i18n";
import screen from "../play/screen.module.css";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import styles from "./free-play.module.css";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeCrossword,
  type FreeCrosswordDeps,
  type FreeCrosswordPuzzle,
} from "./use-free-crossword";

const copy = messages.games.crossword.play;

export function CrosswordFreeScreen({
  deps,
}: {
  readonly deps?: FreeCrosswordDeps;
}) {
  const { phase, regenerate } = useFreeCrossword(deps);

  if (phase.kind === "ready") {
    return (
      <CrosswordFreeBoard
        key={`${String(phase.puzzle.seed)}:${String(phase.run)}`}
        puzzle={phase.puzzle}
        onNext={regenerate}
      />
    );
  }

  return (
    <FreePlayChrome
      game="crossword"
      pageModifier={boardStyles.pageCrossword ?? ""}
      kicker={messages.games.crossword.kicker}
      title={copy.title}
      rules={copy.rules}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
    >
      {phase.kind === "failed" ? (
        <FreePlayErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard />
      )}
    </FreePlayChrome>
  );
}

function CrosswordFreeBoard({
  puzzle,
  onNext,
}: {
  readonly puzzle: FreeCrosswordPuzzle;
  readonly onNext: () => void;
}) {
  const { dispatch, ...board } = useCrosswordBoard(puzzle.daily);

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, [dispatch]);

  if (board.state.status === "solved") {
    return <FreePlaySolvedCard game="crossword" onAgain={onNext} />;
  }

  return (
    <FreePlayChrome
      game="crossword"
      pageModifier={boardStyles.pageCrossword ?? ""}
      kicker={messages.games.crossword.kicker}
      title={copy.title}
      rules={copy.rules}
      state={{ kind: "playing", readouts: crosswordReadouts(board) }}
    >
      <CrosswordBoardView board={board} />
    </FreePlayChrome>
  );
}

function GeneratingBoard() {
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeyboardSkeleton />
      <p className={styles.generating}>{messages.freePlay.generating}</p>
    </>
  );
}
