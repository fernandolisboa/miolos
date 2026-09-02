"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { messages } from "../i18n";
import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import { countFilled } from "../play/progress";
import screen from "../play/screen.module.css";
import { Board, BoardSkeleton } from "../sudoku/board";
import { playableGivens } from "../sudoku/engine";
import { Keypad, KeypadSkeleton } from "../sudoku/keypad";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
} from "../sudoku/state";
import boardStyles from "../sudoku/sudoku-board.module.css";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { FreePlayChrome } from "./chrome";
import styles from "./free-play.module.css";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeSudoku,
  type FreeSudokuDeps,
  type FreeSudokuPuzzle,
} from "./use-free-sudoku";

const TOTAL_CELLS = 81;

const copy = messages.games.sudoku.play;

export function SudokuFreeScreen({ deps }: { readonly deps?: FreeSudokuDeps }) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const { phase, regenerate } = useFreeSudoku(level, deps);

  if (phase.kind === "ready") {
    return (
      <SudokuFreeBoard
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
      game="sudoku"
      pageModifier={boardStyles.pageSudoku ?? ""}
      kicker={messages.games.sudoku.kicker}
      title={copy.title}
      rules={copy.rules}
      level={level}
      onLevelChange={setLevel}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
    >
      {phase.kind === "failed" ? (
        <ErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard />
      )}
    </FreePlayChrome>
  );
}

function SudokuFreeBoard({
  level,
  onLevelChange,
  puzzle,
  onNext,
}: {
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly puzzle: FreeSudokuPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    sudokuPlayReducer,
    puzzle.daily,
    initSudokuPlayState,
  );
  const [hintKind, setHintKind] = useState<Hint<SudokuDigit>["kind"] | null>(
    null,
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const filled = countFilled(playableGivens(state.givens), state.entries);
  const hintReady =
    state.hint.used < state.hint.free && state.status === "playing";

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const enterDigit = useCallback((digit: SudokuDigit) => {
    dispatch({ type: "enter-digit", digit });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }

    const hint = nextHint(
      puzzle.solution,
      playableGivens(current.givens),
      current.entries,
    );
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution: puzzle.solution });
  }, [puzzle.solution]);

  if (state.status === "solved") {
    return <FreePlaySolvedCard game="sudoku" level={level} onAgain={onNext} />;
  }

  return (
    <FreePlayChrome
      game="sudoku"
      pageModifier={boardStyles.pageSudoku ?? ""}
      kicker={messages.games.sudoku.kicker}
      title={copy.title}
      rules={copy.rules}
      level={level}
      onLevelChange={onLevelChange}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(
            messages.freePlay.level[level],
            filled,
            TOTAL_CELLS,
          ),
          progressLong: copy.progressLong(filled, TOTAL_CELLS),
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
          givens={state.givens}
          entries={state.entries}
          selected={state.selected}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          onSelect={selectCell}
          onMove={moveSelection}
          onDigit={enterDigit}
          onClear={clearCell}
        />
      </div>
      <Keypad onDigit={enterDigit} onClear={clearCell} />
    </FreePlayChrome>
  );
}

function GeneratingBoard() {
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeypadSkeleton />
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
