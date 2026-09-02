"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import boardStyles from "../binairo/binairo-screen.module.css";
import { Controls } from "../binairo/controls";
import { Grid } from "../binairo/grid";
import {
  initPlayState,
  playReducer,
  sameMode,
  type PaintMode,
} from "../binairo/state";
import { messages } from "../i18n";
import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import { countFilled } from "../play/progress";
import screen from "../play/screen.module.css";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import { FreePlayChrome } from "./chrome";
import styles from "./free-play.module.css";
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
      kicker={messages.games.binairo.kicker}
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
  const [hintKind, setHintKind] = useState<Hint<0 | 1 | null>["kind"] | null>(
    null,
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const filled = countFilled(state.givens, state.entries);
  const hintReady =
    state.hint.used < state.hint.free && state.status === "playing";

  const tapCell = useCallback((index: number) => {
    dispatch({ type: "tap", index });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const toggleMode = useCallback((mode: PaintMode) => {
    dispatch({
      type: "set-mode",
      mode: sameMode(stateRef.current.paint, mode) ? { kind: "cycle" } : mode,
    });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (current.hint.used >= current.hint.free || current.status === "solved") {
      return;
    }

    const hint = nextHint(puzzle.solution, current.givens, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution: puzzle.solution });
  }, [puzzle.solution]);

  if (state.status === "solved") {
    return <FreePlaySolvedCard game="binairo" level={level} onAgain={onNext} />;
  }

  return (
    <FreePlayChrome
      game="binairo"
      pageModifier={boardStyles.pageBinairo ?? ""}
      kicker={messages.games.binairo.kicker}
      title={copy.title}
      rules={copy.rules}
      level={level}
      onLevelChange={onLevelChange}
      state={{
        kind: "playing",
        readouts: {
          progressShort: copy.progressShort(filled, TOTAL_CELLS),
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
        <Grid
          givens={state.givens}
          entries={state.entries}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          painting={state.paint.kind !== "cycle"}
          onTap={tapCell}
          onPaintOver={paintOver}
        />
      </div>
      <Controls paint={state.paint} onToggleMode={toggleMode} />
    </FreePlayChrome>
  );
}

function GeneratingBoard() {
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <div className={boardStyles.grid}>
          {Array.from({ length: TOTAL_CELLS }, (_unused, index) => (
            <div
              key={index}
              className={`${boardStyles.cell} ${boardStyles.cellSkeleton}`}
            />
          ))}
        </div>
      </div>

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
