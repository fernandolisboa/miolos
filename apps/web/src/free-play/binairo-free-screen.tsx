"use client";

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

import boardStyles from "../binairo/binairo-screen.module.css";
import { Controls } from "../binairo/controls";
import { Grid } from "../binairo/grid";
import {
  initPlayState,
  playReducer,
  sameMode,
  type PaintMode,
} from "../binairo/state";
import { messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import { countFilled } from "../play/progress";
import screen from "../play/screen.module.css";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import styles from "./free-play.module.css";
import { LevelPicker } from "./level-picker";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeBinairo,
  type FreeBinairoDeps,
  type FreeBinairoPuzzle,
} from "./use-free-binairo";

const ACCENT = accentVars("binairo");

const TOTAL_CELLS = 64;

const BLANK_READOUT = "\u00a0";

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
    <Frame
      playState={phase.kind === "failed" ? "error" : "generating"}
      level={level}
      onLevelChange={setLevel}
      progressLong={null}
      progressShort={null}
      hint={null}
      hintKind={null}
    >
      {phase.kind === "failed" ? (
        <ErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard />
      )}
    </Frame>
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
    <Frame
      playState="playing"
      level={level}
      onLevelChange={onLevelChange}
      progressLong={messages.games.binairo.play.progressLong(
        filled,
        TOTAL_CELLS,
      )}
      progressShort={messages.games.binairo.play.progressShort(
        filled,
        TOTAL_CELLS,
      )}
      hint={{ ready: hintReady, onReveal: revealHint }}
      hintKind={hintKind}
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
    </Frame>
  );
}

function Frame({
  playState,
  level,
  onLevelChange,
  progressLong,
  progressShort,
  hint,
  hintKind,
  children,
}: {
  readonly playState: "generating" | "error" | "playing";
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly progressLong: string | null;
  readonly progressShort: string | null;

  readonly hint: {
    readonly ready: boolean;
    readonly onReveal: () => void;
  } | null;
  readonly hintKind: "correction" | "fill" | null;
  readonly children: ReactNode;
}) {
  const copy = messages.games.binairo.play;

  return (
    <main
      className={`${screen.page} ${boardStyles.pageBinairo}`}
      style={ACCENT}
      data-play-state={playState}
    >
      <header className={screen.topBar}>
        <Link
          className={screen.back}
          href={routes.freePlay}
          aria-label={messages.freePlay.backToIndexAria}
        >
          {messages.freePlay.back}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>
          {messages.games.binairo.kicker}
        </span>

        <span className={screen.topDate}>{messages.freePlay.modeTag}</span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.binairo.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
          {progressShort === null ? (
            <span aria-hidden className={screen.progressBar}>
              {BLANK_READOUT}
            </span>
          ) : (
            <span className={screen.progressBar}>{progressShort}</span>
          )}
        </div>
        <p className={screen.rules}>{copy.rules}</p>
      </div>

      <div className={screen.statsCard}>
        <div aria-hidden className={screen.tape} />
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          {progressLong === null ? (
            <span aria-hidden className={screen.progressCard}>
              {BLANK_READOUT}
            </span>
          ) : (
            <span className={screen.progressCard}>{progressLong}</span>
          )}
        </div>

        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.freePlay.level.label}
          </span>
          <span className={screen.progressCard}>
            {messages.freePlay.level[level]}
          </span>
        </div>
      </div>

      <section className={screen.board}>
        <LevelPicker level={level} onChange={onLevelChange} />
        {children}
        {hintKind !== null && (
          <p className={screen.hintExplain}>{copy.hint.explain[hintKind]}</p>
        )}
      </section>

      {hint === null ? (
        <div
          aria-hidden
          className={`${screen.hint} ${screen.hintUsed} ${screen.placeholder}`}
        >
          {BLANK_READOUT}
        </div>
      ) : (
        <button
          type="button"
          className={`${screen.hint}${hint.ready ? "" : ` ${screen.hintUsed}`}`}
          aria-disabled={!hint.ready}
          onClick={hint.onReveal}
        >
          {hint.ready ? copy.hint.available : copy.hint.used}
        </button>
      )}
    </main>
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
