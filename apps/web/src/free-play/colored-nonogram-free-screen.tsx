"use client";

import type { NonogramSize } from "@miolos/core";
import { useCallback, useEffect, useReducer } from "react";

import { ColoredBoard } from "../colored-nonogram/board";
import styles from "../colored-nonogram/colored-board.module.css";
import { ColoredControls } from "../colored-nonogram/controls";
import { coloredHintExplanation } from "../colored-nonogram/hint";
import {
  coloredNonogramReducer,
  initColoredNonogramState,
} from "../colored-nonogram/state";
import { messages } from "../i18n";
import { countFilledCells } from "../nonogram/engine";
import { nonogramPageModifier } from "../nonogram/page-class";
import { useNonogramControls } from "../nonogram/use-nonogram-controls";
import { BoardCard } from "../play/board-card";
import { EndingStage } from "../play/ending-stage";
import type { FreePlayLevel } from "./catalog";
import { FreePlayChrome } from "./chrome";
import { FreePlayPicture } from "./free-play-picture";
import {
  NonogramFreeShell,
  pictureReadouts,
  type NonogramChoices,
} from "./nonogram-free-shell";
import { FreePlaySolvedCard } from "./solved-card";
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
  readonly choices: NonogramChoices;
  readonly pickSeed: (() => number) | undefined;
}) {
  const { phase, regenerate } = useFreeColoredNonogram(level, { pickSeed });

  if (phase.kind !== "ready") {
    return (
      <NonogramFreeShell
        level={level}
        choices={choices}
        {...(phase.kind === "failed" ? { onRetry: regenerate } : {})}
      />
    );
  }
  return (
    <ColoredFreeBoard
      key={`${String(phase.puzzle.seed)}:${level}:${String(phase.run)}`}
      choices={choices}
      puzzle={phase.puzzle}
      onNext={regenerate}
    />
  );
}

function ColoredFreeBoard({
  choices,
  puzzle,
  onNext,
}: {
  readonly choices: NonogramChoices;
  readonly puzzle: FreeColoredNonogramPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    coloredNonogramReducer,
    puzzle,
    initColoredNonogramState,
  );
  const controls = useNonogramControls(state, dispatch);
  const setTone = useCallback((tone: number) => {
    dispatch({ type: "set-tone", tone });
  }, []);

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const { size, clues, solution } = puzzle;
  return (
    <EndingStage
      over={state.status === "solved"}
      won
      ending={() => (
        <FreePlaySolvedCard
          game="nonogram"
          choices={choices}
          onAgain={onNext}
          picture={
            <FreePlayPicture
              picture={{
                size,
                cells: solution.map((mark) => (mark === 0 ? 0 : 1)),
                label: messages.freePlay.solved.pictureAria,
                tones: solution
                  .map((mark) => clues.palette[mark - 1] ?? ".")
                  .join(""),
              }}
            />
          }
        />
      )}
    >
      <FreePlayChrome
        game="nonogram"
        choices={choices}
        pageModifier={`${nonogramPageModifier(size)} ${styles.pageColored ?? ""} ${OVERHANG[size] ?? ""}`}
        state={{
          kind: "playing",
          readouts: pictureReadouts(
            size,
            countFilledCells(state.entries),
            countFilledCells(solution),
            {
              state: state.hint,
              explain: coloredHintExplanation(clues, state.hint.reason),
            },
            controls,
          ),
        }}
      >
        <BoardCard
          below={
            <ColoredControls
              palette={clues.palette}
              brush={state.brush}
              tone={state.tone}
              onSetBrush={controls.setBrush}
              onSetTone={setTone}
            />
          }
        >
          <ColoredBoard
            size={size}
            clues={clues}
            solution={state.solution}
            entries={state.entries}
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
        </BoardCard>
      </FreePlayChrome>
    </EndingStage>
  );
}
