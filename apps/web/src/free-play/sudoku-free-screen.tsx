"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { hintReadout } from "../play/hint-readout";
import { countFilled } from "../play/progress";
import { useBoardEdits } from "../play/undo";
import { Board, BoardSkeleton } from "../sudoku/board";
import { mergedGrid, playableGivens } from "../sudoku/engine";
import { sudokuHintExplanation } from "../sudoku/hint";
import { Keypad, KeypadSkeleton } from "../sudoku/keypad";
import {
  canHint,
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
} from "../sudoku/state";
import boardStyles from "../sudoku/sudoku-board.module.css";
import { useDigitLock } from "../sudoku/use-digit-lock";
import { EndingStage } from "../play/ending-stage";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { levelChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";
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
      choices={[levelChoice(level, setLevel)]}
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
  const allowance = useFreeHintsPerPuzzle();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const filled = countFilled(playableGivens(state.givens), state.entries);
  const hintReady = canHint(state, allowance);

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
    if (!canHint(stateRef.current, allowance)) {
      return;
    }
    dispatch({ type: "use-hint", solution: puzzle.solution });
  }, [puzzle.solution, allowance]);

  const lock = useDigitLock(state, dispatch);

  const edits = useBoardEdits(state, dispatch);

  const choices = [levelChoice(level, onLevelChange)];
  return (
    <EndingStage
      over={state.status === "solved"}
      won
      ending={() => (
        <FreePlaySolvedCard game="sudoku" choices={choices} onAgain={onNext} />
      )}
    >
      <FreePlayChrome
        game="sudoku"
        pageModifier={boardStyles.pageSudoku ?? ""}
        choices={choices}
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
              ...hintReadout(
                state.hint,
                sudokuHintExplanation(state.hint.reason),
              ),
              ready: hintReady,
              onReveal: revealHint,
            },
            ...edits,
          },
        }}
      >
        <BoardCard
          below={
            <Keypad
              lock={lock}
              grid={mergedGrid(state.givens, state.entries)}
            />
          }
        >
          <Board
            givens={state.givens}
            solution={puzzle.solution}
            entries={state.entries}
            selected={state.selected}
            violating={state.violating}
            hintIndex={state.hint.lastIndex}
            spotlight={state.hint.spotlight}
            onSelect={selectCell}
            onMove={moveSelection}
            onDigit={enterDigit}
            onClear={clearCell}
            onTapCell={lock.tapCell}
          />
        </BoardCard>
      </FreePlayChrome>
    </EndingStage>
  );
}

function GeneratingBoard() {
  return (
    <>
      <BoardCard
        placeholder
        below={<KeypadSkeleton />}
        overlay={<GeneratingNote />}
      >
        <BoardSkeleton />
      </BoardCard>
    </>
  );
}
