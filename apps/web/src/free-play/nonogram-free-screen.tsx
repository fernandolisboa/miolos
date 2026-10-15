"use client";

import { useEffect, useReducer, useState } from "react";

import { lazyChunk } from "../components/lazy-chunk";
import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { Board } from "../nonogram/board";
import { Controls } from "../nonogram/controls";
import { countFilledCells, filledTarget } from "../nonogram/engine";
import { nonogramHintExplanation } from "../nonogram/hint";
import { nonogramPageModifier } from "../nonogram/page-class";
import { initNonogramPlayState, nonogramPlayReducer } from "../nonogram/state";
import { useNonogramControls } from "../nonogram/use-nonogram-controls";
import { EndingStage } from "../play/ending-stage";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { levelChoice, type FreePlayChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayPicture } from "./free-play-picture";
import {
  NONOGRAM_VARIANTS,
  NonogramFreeShell,
  pictureReadouts,
  type NonogramChoices,
  type NonogramVariant,
} from "./nonogram-free-shell";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeNonogram,
  type FreeNonogramDeps,
  type FreeNonogramPuzzle,
} from "./use-free-nonogram";

let ColoredScreen:
  | typeof import("./colored-nonogram-free-screen").ColoredNonogramFreeScreen
  | null = null;
const useColoredChunk = lazyChunk(() =>
  import("./colored-nonogram-free-screen").then((module) => {
    ColoredScreen = module.ColoredNonogramFreeScreen;
  }),
);

function variantChoice(
  variant: NonogramVariant,
  onChange: (variant: NonogramVariant) => void,
): FreePlayChoice<NonogramVariant> {
  const copy = messages.freePlay.variant;
  return {
    label: copy.label,
    options: NONOGRAM_VARIANTS,
    value: variant,
    optionLabel: (option) => copy[option],
    optionAria: (option) => copy.aria(copy[option]),
    onChange,
  };
}

export function NonogramFreeScreen({
  deps,
}: {
  readonly deps?: FreeNonogramDeps;
}) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const [variant, setVariant] = useState<NonogramVariant>("classico");
  const choices: NonogramChoices = [
    levelChoice(level, setLevel),
    variantChoice(variant, setVariant),
  ];

  return variant === "classico" ? (
    <ClassicFreeNonogram level={level} choices={choices} deps={deps} />
  ) : (
    <ColoredFreeNonogram
      level={level}
      choices={choices}
      pickSeed={deps?.pickSeed}
    />
  );
}

function ColoredFreeNonogram({
  level,
  choices,
  pickSeed,
}: {
  readonly level: FreePlayLevel;
  readonly choices: NonogramChoices;
  readonly pickSeed: (() => number) | undefined;
}) {
  const [asks, setAsks] = useState(0);
  const chunk = useColoredChunk(asks);

  if (chunk === "ready" && ColoredScreen !== null) {
    return (
      <ColoredScreen level={level} choices={choices} pickSeed={pickSeed} />
    );
  }
  return (
    <NonogramFreeShell
      level={level}
      choices={choices}
      {...(chunk === "failed"
        ? { onRetry: () => setAsks((count) => count + 1) }
        : {})}
    />
  );
}

function ClassicFreeNonogram({
  level,
  choices,
  deps,
}: {
  readonly level: FreePlayLevel;
  readonly choices: NonogramChoices;
  readonly deps: FreeNonogramDeps | undefined;
}) {
  const { phase, regenerate } = useFreeNonogram(level, deps);

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
    <ClassicFreeBoard
      key={`${String(phase.puzzle.seed)}:${level}:${String(phase.run)}`}
      choices={choices}
      puzzle={phase.puzzle}
      onNext={regenerate}
    />
  );
}

function ClassicFreeBoard({
  choices,
  puzzle,
  onNext,
}: {
  readonly choices: NonogramChoices;
  readonly puzzle: FreeNonogramPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    puzzle.daily,
    initNonogramPlayState,
  );
  const controls = useNonogramControls(state, dispatch);

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const picture = state.status === "solved" ? state.solution : null;
  return (
    <EndingStage
      over={picture !== null}
      won
      ending={() => (
        <FreePlaySolvedCard
          game="nonogram"
          choices={choices}
          onAgain={onNext}
          picture={
            <FreePlayPicture
              picture={{
                size: state.size,
                cells: picture ?? [],
                label: messages.freePlay.solved.pictureAria,
                tones: puzzle.tones,
              }}
            />
          }
        />
      )}
    >
      <FreePlayChrome
        game="nonogram"
        choices={choices}
        pageModifier={nonogramPageModifier(state.size)}
        state={{
          kind: "playing",
          readouts: pictureReadouts(
            state.size,
            countFilledCells(state.entries),
            filledTarget(state.clues),
            {
              state: state.hint,
              explain: nonogramHintExplanation(state.size, state.hint.reason),
            },
            controls,
          ),
        }}
      >
        <BoardCard
          below={
            <Controls brush={state.brush} onSetBrush={controls.setBrush} />
          }
        >
          <Board
            size={state.size}
            clues={state.clues}
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
