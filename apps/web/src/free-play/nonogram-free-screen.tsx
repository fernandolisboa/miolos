"use client";

import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";

import { messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { Board, BoardSkeleton } from "../nonogram/board";
import { Controls, ControlsSkeleton } from "../nonogram/controls";
import {
  countFilledCells,
  filledTarget,
  hintKindOf,
  nextNonogramHint,
  type NonogramHintKind,
} from "../nonogram/engine";
import boardStyles from "../nonogram/nonogram-board.module.css";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramBrush,
  type NonogramMark,
} from "../nonogram/state";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import styles from "./free-play.module.css";
import { LevelPicker } from "./level-picker";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeNonogram,
  type FreeNonogramDeps,
  type FreeNonogramPuzzle,
} from "./use-free-nonogram";

const ACCENT = accentVars("nonogram");

const BLANK_READOUT = "\u00a0";

const LEVEL_SIZES: Readonly<Record<FreePlayLevel, NonogramSize>> = {
  leve: 5,
  medio: 10,
  dificil: 15,
};

export function NonogramFreeScreen({
  deps,
}: {
  readonly deps?: FreeNonogramDeps;
}) {
  const [level, setLevel] = useState<FreePlayLevel>(DEFAULT_FREE_PLAY_LEVEL);
  const { phase, regenerate } = useFreeNonogram(level, deps);

  if (phase.kind === "ready") {
    return (
      <NonogramFreeBoard
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
      size={LEVEL_SIZES[level]}
      progressLong={null}
      progressShort={null}
      hint={null}
      hintKind={null}
    >
      {phase.kind === "failed" ? (
        <ErrorCard onRetry={regenerate} />
      ) : (
        <GeneratingBoard size={LEVEL_SIZES[level]} />
      )}
    </Frame>
  );
}

function NonogramFreeBoard({
  level,
  onLevelChange,
  puzzle,
  onNext,
}: {
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly puzzle: FreeNonogramPuzzle;
  readonly onNext: () => void;
}) {
  const [state, dispatch] = useReducer(
    nonogramPlayReducer,
    puzzle.daily,
    initNonogramPlayState,
  );
  const [hintKind, setHintKind] = useState<NonogramHintKind | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const target = filledTarget(state.clues);
  const filled = countFilledCells(state.entries);
  const hintReady =
    state.solution !== null &&
    state.hint.used < state.hint.free &&
    state.status === "playing";

  const selectCell = useCallback((index: number) => {
    dispatch({ type: "select", index });
  }, []);

  const moveSelection = useCallback((rows: number, columns: number) => {
    dispatch({ type: "move-selection", rows, columns });
  }, []);

  const setBrush = useCallback((brush: NonogramBrush) => {
    dispatch({ type: "set-brush", brush });
  }, []);

  const markCell = useCallback((index: number) => {
    dispatch({ type: "mark-cell", index });
  }, []);

  const enterValue = useCallback((value: NonogramMark) => {
    dispatch({ type: "enter-value", value });
  }, []);

  const clearCell = useCallback(() => {
    dispatch({ type: "clear-cell" });
  }, []);

  const paintOver = useCallback((index: number) => {
    dispatch({ type: "paint-over", index });
  }, []);

  const revealHint = useCallback(() => {
    const current = stateRef.current;
    if (
      current.solution === null ||
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }

    const hint = nextNonogramHint(current.solution, current.entries);
    if (hint === null) {
      return;
    }
    setHintKind(hintKindOf(hint));
    dispatch({ type: "use-hint" });
  }, []);

  if (state.status === "solved" && state.solution !== null) {
    return (
      <FreePlaySolvedCard
        game="nonogram"
        level={level}
        onAgain={onNext}
        picture={{
          size: state.size,
          cells: state.solution,
          label: messages.freePlay.solved.pictureAria,
        }}
      />
    );
  }

  return (
    <Frame
      playState="playing"
      level={level}
      onLevelChange={onLevelChange}
      size={state.size}
      progressLong={messages.games.nonogram.play.progressLong(filled, target)}
      progressShort={messages.games.nonogram.play.progressShort(
        state.size,
        filled,
        target,
      )}
      hint={{ ready: hintReady, onReveal: revealHint }}
      hintKind={hintKind}
    >
      <div className={screen.gridCard}>
        <Board
          size={state.size}
          clues={state.clues}
          entries={state.entries}
          selected={state.selected}
          hintIndex={state.hint.lastIndex}
          onSelect={selectCell}
          onMove={moveSelection}
          onMarkCell={markCell}
          onEnterValue={enterValue}
          onClear={clearCell}
          onPaintOver={paintOver}
        />
      </div>
      <Controls brush={state.brush} onSetBrush={setBrush} />
    </Frame>
  );
}

function Frame({
  playState,
  level,
  onLevelChange,
  size,
  progressLong,
  progressShort,
  hint,
  hintKind,
  children,
}: {
  readonly playState: "generating" | "error" | "playing";
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly size: NonogramSize;
  readonly progressLong: string | null;
  readonly progressShort: string | null;
  readonly hint: {
    readonly ready: boolean;
    readonly onReveal: () => void;
  } | null;
  readonly hintKind: NonogramHintKind | null;
  readonly children: ReactNode;
}) {
  const copy = messages.games.nonogram.play;

  return (
    <main
      className={pageClassName(size)}
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
          {messages.games.nonogram.kicker}
        </span>
        <span className={screen.topDate}>{messages.freePlay.modeTag}</span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.nonogram.kicker}</p>
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

function GeneratingBoard({ size }: { readonly size: NonogramSize }) {
  const emptyClues: NonogramClues = {
    size,
    rows: Array.from({ length: size }, () => []),
    cols: Array.from({ length: size }, () => []),
  };
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton size={size} clues={emptyClues} />
      </div>
      <ControlsSkeleton />
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

function pageClassName(size: NonogramSize): string {
  const cap = size === 5 ? ` ${boardStyles.mobileCap5}` : "";
  return `${screen.page} ${boardStyles.pageNonogram}${cap}`;
}
