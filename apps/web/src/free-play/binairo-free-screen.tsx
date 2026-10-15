"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import boardStyles from "../binairo/binairo-screen.module.css";
import { Controls, ControlsSkeleton } from "../binairo/controls";
import { Grid } from "../binairo/grid";
import { binairoHintExplanation } from "../binairo/hint";
import { canHint, initPlayState, playReducer } from "../binairo/state";
import { useBinairoControls } from "../binairo/use-binairo-controls";
import { messages } from "../i18n";
import { EndingStage } from "../play/ending-stage";
import { BoardCard } from "../play/board-card";
import { useFreeHintsPerPuzzle } from "../play/free-hints";
import { hintReadout } from "../play/hint-readout";
import { countFilled } from "../play/progress";
import { hasDecidedCell } from "../play/reset-board";
import { useReset } from "../play/use-reset";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { levelChoice } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeBinairo,
  type FreeBinairoDeps,
  type FreeBinairoPuzzle,
} from "./use-free-binairo";

const TOTAL_CELLS = 64;

const copy = messages.games.binairo.play;

export function BinairoFreeScreen({
  deps,
}: {
  readonly deps?: FreeBinairoDeps;
}) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const { phase, regenerate } = useFreeBinairo(level, deps);

  if (phase.kind === "ready") {
    return (
      <BinairoFreeBoard
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
      game="binairo"
      pageModifier={boardStyles.pageBinairo ?? ""}
      choice={levelChoice(level, setLevel)}
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

function BinairoFreeBoard({
  level,
  onLevelChange,
  puzzle,
  onNext,
}: {
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly puzzle: FreeBinairoPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    playReducer,
    puzzle.daily,
    initPlayState,
  );
  const { tapCell, strokeStart, paintOver, toggleMode } =
    useBinairoControls(dispatch);
  const allowance = useFreeHintsPerPuzzle();

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const filled = countFilled(state.givens, state.entries);
  const hintReady = canHint(state, allowance);

  const revealHint = useCallback(() => {
    if (canHint(stateRef.current, allowance)) {
      dispatch({ type: "use-hint", solution: puzzle.solution });
    }
  }, [puzzle.solution, allowance]);

  const reset = useReset(dispatch);

  const choice = levelChoice(level, onLevelChange);
  return (
    <EndingStage
      over={state.status === "solved"}
      won
      ending={() => (
        <FreePlaySolvedCard game="binairo" choice={choice} onAgain={onNext} />
      )}
    >
      <FreePlayChrome
        game="binairo"
        pageModifier={boardStyles.pageBinairo ?? ""}
        choice={choice}
        state={{
          kind: "playing",
          readouts: {
            progressShort: copy.progressShort(filled, TOTAL_CELLS),
            progressLong: copy.progressLong(filled, TOTAL_CELLS),
            hint: {
              ...hintReadout(
                state.hint,
                binairoHintExplanation(state.hint.reason),
              ),
              ready: hintReady,
              onReveal: revealHint,
            },
            onReset: hasDecidedCell(state.entries) ? reset : null,
          },
        }}
      >
        <BoardCard
          below={<Controls paint={state.paint} onToggleMode={toggleMode} />}
        >
          <Grid
            givens={state.givens}
            solution={puzzle.solution}
            entries={state.entries}
            violating={state.violating}
            hintIndex={state.hint.lastIndex}
            spotlight={state.hint.spotlight}
            painting={state.paint.kind !== "cycle"}
            onTap={tapCell}
            onStrokeStart={strokeStart}
            onPaintOver={paintOver}
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
        below={<ControlsSkeleton />}
        overlay={<GeneratingNote />}
      >
        <div className={boardStyles.grid}>
          {Array.from({ length: TOTAL_CELLS }, (_unused, index) => (
            <div
              key={index}
              className={`${boardStyles.cell} ${boardStyles.cellSkeleton}`}
            />
          ))}
        </div>
      </BoardCard>
    </>
  );
}
