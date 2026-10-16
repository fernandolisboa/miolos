"use client";

import type { NonogramSize } from "@miolos/core";
import { useCallback } from "react";

import { ColoredBoard } from "../colored-nonogram/board";
import styles from "../colored-nonogram/colored-board.module.css";
import { ColoredControls } from "../colored-nonogram/controls";
import { coloredHintExplanation } from "../colored-nonogram/hint";
import {
  coloredNonogramReducer,
  initColoredNonogramState,
} from "../colored-nonogram/state";
import { countFilledCells } from "../nonogram/engine";
import { nonogramPageModifier } from "../nonogram/page-class";
import { useNonogramControls } from "../nonogram/use-nonogram-controls";
import { SOLUTION_MISTAKES, usePlayReducer } from "../play/mistakes";
import { NONOGRAM_LEVEL_SIZES, type FreePlayLevel } from "./catalog";
import type { Choice } from "./choice";
import { PictureFreeFrame, PictureFreeScreen } from "./picture-free-frame";
import {
  useFreeColoredNonogram,
  type FreeColoredNonogramPuzzle,
} from "./use-free-colored-nonogram";

const OVERHANG = {
  5: styles.overhang5,
  8: undefined,
  10: styles.overhang10,
  15: styles.overhang15,
} satisfies Record<NonogramSize, string | undefined>;

export function ColoredNonogramFreeScreen({
  level,
  choices,
  pickSeed,
}: {
  readonly level: FreePlayLevel;
  readonly choices: readonly Choice[];
  readonly pickSeed: (() => number) | undefined;
}) {
  const generation = useFreeColoredNonogram(level, { pickSeed });
  const size = NONOGRAM_LEVEL_SIZES[level];
  return (
    <PictureFreeScreen
      level={level}
      choices={choices}
      generation={generation}
      board={(puzzle, onNext) => (
        <ColoredFreeBoard
          size={size}
          choices={choices}
          puzzle={puzzle}
          onNext={onNext}
        />
      )}
    />
  );
}

function ColoredFreeBoard({
  size,
  choices,
  puzzle,
  onNext,
}: {
  readonly size: NonogramSize;
  readonly choices: readonly Choice[];
  readonly puzzle: FreeColoredNonogramPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = usePlayReducer(
    coloredNonogramReducer,
    puzzle,
    initColoredNonogramState,
    SOLUTION_MISTAKES,
  );
  const controls = useNonogramControls(state, dispatch);
  const setTone = useCallback(
    (tone: number) => {
      dispatch({ type: "set-tone", tone });
    },
    [dispatch],
  );

  const { clues, solution } = puzzle;
  return (
    <PictureFreeFrame
      choices={choices}
      size={size}
      pageModifier={[
        nonogramPageModifier(size),
        styles.pageColored,
        OVERHANG[size],
      ]
        .filter((name) => name !== undefined)
        .join(" ")}
      picture={
        state.status === "solved"
          ? {
              size,
              cells: solution.map((mark) => (mark === 0 ? 0 : 1)),
              tones: puzzle.tones,
            }
          : null
      }
      filled={countFilledCells(state.entries)}
      target={countFilledCells(solution)}
      hint={{
        state: state.hint,
        explain: coloredHintExplanation(clues, state.hint.reason),
      }}
      controls={controls}
      dispatch={dispatch}
      below={
        <ColoredControls
          palette={clues.palette}
          brush={state.brush}
          tone={state.tone}
          onSetBrush={controls.setBrush}
          onSetTone={setTone}
        />
      }
      onNext={onNext}
    >
      <ColoredBoard
        size={size}
        clues={clues}
        solution={state.solution}
        entries={state.entries}
        mistakes={state.mistakes}
        selected={state.selected}
        hintIndex={state.hint.lastIndex}
        spotlight={state.hint.spotlight}
        onSelect={controls.selectCell}
        onMove={controls.moveSelection}
        onMarkCell={controls.markCell}
        onStrokeStart={controls.strokeStart}
        onEnterValue={controls.enterValue}
        onClear={controls.clearCell}
        onPaintOver={controls.paintOver}
      />
    </PictureFreeFrame>
  );
}
