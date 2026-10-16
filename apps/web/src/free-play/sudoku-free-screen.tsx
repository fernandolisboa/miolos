"use client";

import { SUDOKU_VARIANTS, type SudokuVariant } from "@miolos/games/sudoku";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { hintReadout } from "../play/hint-readout";
import { usePlayReducer } from "../play/mistakes";
import { countFilled } from "../play/progress";
import { Board, BoardSkeleton } from "../sudoku/board";
import { mergedGrid, playableGivens } from "../sudoku/engine";
import { sudokuHintExplanation } from "../sudoku/hint";
import { Keypad, KeypadSkeleton } from "../sudoku/keypad";
import {
  canHint,
  initSudokuPlayState,
  sudokuMistakes,
  sudokuPlayReducer,
} from "../sudoku/state";
import boardStyles from "../sudoku/sudoku-board.module.css";
import { useSudokuInput } from "../sudoku/use-sudoku-input";
import { EndingStage } from "../play/ending-stage";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import type { Choice } from "./choice";
import { levelChoice, variantChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";
import { FreePlaySolvedCard } from "./solved-card";
import { namedHint, PLAIN_LOOK, sudokuLook } from "./sudoku-layout";
import {
  useFreeSudoku,
  type FreeSudokuDeps,
  type FreeSudokuPuzzle,
} from "./use-free-sudoku";
import { VariantMenu } from "./variant-menu";
import { VariantTrigger } from "./variant-trigger";

const TOTAL_CELLS = 81;

const copy = messages.games.sudoku.play;

const variantCopy = messages.freePlay.sudokuVariant;

export function SudokuFreeScreen({ deps }: { readonly deps?: FreeSudokuDeps }) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const [variant, setVariant] = useState<SudokuVariant>("classic");
  const input = useMemo(() => ({ level, variant }), [level, variant]);
  const { phase, regenerate } = useFreeSudoku(input, deps);
  const menuId = useId();
  const variantPick = variantChoice(
    SUDOKU_VARIANTS,
    variantCopy,
    variant,
    setVariant,
  );
  const choices = [levelChoice(level, setLevel)];
  const rules = variantCopy.rules[variant];
  const picker = (
    <>
      <VariantTrigger name={variantCopy[variant]} menuId={menuId} />
      <VariantMenu id={menuId} choice={variantPick} rules={rules} />
    </>
  );

  if (phase.kind === "ready") {
    return (
      <SudokuFreeBoard
        key={`${String(phase.puzzle.seed)}:${variant}:${level}:${String(phase.run)}`}
        level={level}
        choices={choices}
        variantPick={variantPick}
        picker={picker}
        rules={rules}
        puzzle={phase.puzzle}
        onNext={regenerate}
      />
    );
  }

  return (
    <FreePlayChrome
      game="sudoku"
      pageModifier={boardStyles.pageSudoku ?? ""}
      choices={choices}
      picker={picker}
      rules={rules}
      state={{ kind: phase.kind === "failed" ? "error" : "generating" }}
    >
      {phase.kind === "failed" ? (
        <FreePlayErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard plain={variant === "irregular"} />
      )}
    </FreePlayChrome>
  );
}

function SudokuFreeBoard({
  level,
  choices,
  variantPick,
  picker,
  rules,
  puzzle,
  onNext,
}: {
  readonly level: FreePlayLevel;
  readonly choices: readonly Choice[];
  readonly variantPick: Choice;
  readonly picker: ReactNode;
  readonly rules: string;
  readonly puzzle: FreeSudokuPuzzle;
  readonly onNext: () => void;
}) {
  const mistakeRules = useMemo(
    () => sudokuMistakes(puzzle.solution, puzzle.daily.givens),
    [puzzle],
  );
  const [state, dispatch] = usePlayReducer(
    sudokuPlayReducer,
    puzzle,
    (start) => initSudokuPlayState(start.daily, start.layout),
    mistakeRules,
  );
  const look = useMemo(() => sudokuLook(puzzle.layout), [puzzle.layout]);
  const allowance = useFreeHintsPerPuzzle();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, [dispatch]);

  const { reason, units } = namedHint(state.hint.reason, puzzle.layout);
  const filled = countFilled(playableGivens(state.givens), state.entries);
  const hintReady = canHint(state, allowance);

  const {
    cleanNotes,
    selectCell,
    moveSelection,
    enterDigit,
    toggleNote,
    toggleNoting,
    clearCell,
    lock,
    edits,
  } = useSudokuInput(state, dispatch);

  const revealHint = useCallback(() => {
    if (!canHint(stateRef.current, allowance)) {
      return;
    }
    dispatch({ type: "use-hint", solution: puzzle.solution, cleanNotes });
  }, [dispatch, puzzle.solution, allowance, cleanNotes]);

  return (
    <EndingStage
      over={state.status === "solved"}
      won
      ending={() => (
        <FreePlaySolvedCard
          game="sudoku"
          choices={[...choices, variantPick]}
          onAgain={onNext}
        />
      )}
    >
      <FreePlayChrome
        game="sudoku"
        pageModifier={boardStyles.pageSudoku ?? ""}
        choices={choices}
        picker={picker}
        rules={rules}
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
              ...hintReadout(state.hint, sudokuHintExplanation(reason, units)),
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
              noting={state.noting}
              onToggleNoting={toggleNoting}
            />
          }
        >
          <Board
            layout={state.layout}
            look={look}
            givens={state.givens}
            solution={puzzle.solution}
            entries={state.entries}
            mistakes={state.mistakes}
            notes={state.notes}
            selected={state.selected}
            locked={lock.locked}
            violating={state.violating}
            hintIndex={state.hint.lastIndex}
            spotlight={state.hint.spotlight}
            onSelect={selectCell}
            onMove={moveSelection}
            onDigit={enterDigit}
            onNote={toggleNote}
            onToggleNoting={toggleNoting}
            onClear={clearCell}
            onTapCell={lock.tapCell}
          />
        </BoardCard>
      </FreePlayChrome>
    </EndingStage>
  );
}

function GeneratingBoard({ plain }: { readonly plain: boolean }) {
  return (
    <>
      <BoardCard
        placeholder
        below={<KeypadSkeleton />}
        overlay={<GeneratingNote />}
      >
        <BoardSkeleton look={plain ? PLAIN_LOOK : undefined} />
      </BoardCard>
    </>
  );
}
