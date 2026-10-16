"use client";

import { useReducer, useState } from "react";

import { lazyChunk } from "../components/lazy-chunk";
import { Board } from "../nonogram/board";
import { Controls } from "../nonogram/controls";
import { countFilledCells, filledTarget } from "../nonogram/engine";
import { nonogramHintExplanation } from "../nonogram/hint";
import { nonogramPageModifier } from "../nonogram/page-class";
import { initNonogramPlayState, nonogramPlayReducer } from "../nonogram/state";
import { useNonogramControls } from "../nonogram/use-nonogram-controls";
import {
  DEFAULT_FREE_PLAY_LEVEL,
  NONOGRAM_VARIANTS,
  type FreePlayLevel,
  type NonogramVariant,
} from "./catalog";
import type { Choice } from "./choice";
import { levelChoice, variantChoice } from "./choice-picker";
import {
  NonogramFreeShell,
  PictureFreeFrame,
  PictureFreeScreen,
} from "./picture-free-frame";
import {
  useFreeNonogram,
  type FreeNonogramDeps,
  type FreeNonogramPuzzle,
} from "./use-free-nonogram";

const useColoredChunk = lazyChunk(() =>
  import("./colored-nonogram-free-screen").then(
    (module) => module.ColoredNonogramFreeScreen,
  ),
);

export function NonogramFreeScreen({
  deps,
}: {
  readonly deps?: FreeNonogramDeps;
}) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const [variant, setVariant] = useState<NonogramVariant>("classico");
  const choices = [
    levelChoice(level, setLevel),
    variantChoice(NONOGRAM_VARIANTS, variant, setVariant),
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
  readonly choices: readonly Choice[];
  readonly pickSeed: (() => number) | undefined;
}) {
  const [asks, setAsks] = useState(0);
  const chunk = useColoredChunk(asks);

  if (chunk.state === "ready") {
    return <chunk.value level={level} choices={choices} pickSeed={pickSeed} />;
  }
  return (
    <NonogramFreeShell
      level={level}
      choices={choices}
      {...(chunk.state === "failed"
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
  readonly choices: readonly Choice[];
  readonly deps: FreeNonogramDeps | undefined;
}) {
  const generation = useFreeNonogram(level, deps);
  return (
    <PictureFreeScreen
      level={level}
      choices={choices}
      generation={generation}
      board={(puzzle, onNext) => (
        <ClassicFreeBoard choices={choices} puzzle={puzzle} onNext={onNext} />
      )}
    />
  );
}

function ClassicFreeBoard({
  choices,
  puzzle,
  onNext,
}: {
  readonly choices: readonly Choice[];
  readonly puzzle: FreeNonogramPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    puzzle.daily,
    initNonogramPlayState,
  );
  const controls = useNonogramControls(state, dispatch);

  return (
    <PictureFreeFrame
      choices={choices}
      size={state.size}
      pageModifier={nonogramPageModifier(state.size)}
      picture={
        state.status === "solved" && state.solution !== null
          ? { size: state.size, cells: state.solution, tones: puzzle.tones }
          : null
      }
      filled={countFilledCells(state.entries)}
      target={filledTarget(state.clues)}
      hint={{
        state: state.hint,
        explain: nonogramHintExplanation(state.size, state.hint.reason),
      }}
      controls={controls}
      dispatch={dispatch}
      below={<Controls brush={state.brush} onSetBrush={controls.setBrush} />}
      onNext={onNext}
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
    </PictureFreeFrame>
  );
}
