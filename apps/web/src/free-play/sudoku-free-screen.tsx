"use client";

/**
 * The /modo-livre/sudoku screen (#28, ADR-0046) — the daily Sudoku play
 * screen's sibling with the free-play differences of plan 025 §7.2. See
 * `binairo-free-screen.tsx` for the pattern's full argument; this file
 * repeats it per game rather than abstracting, exactly as the daily
 * screens do (ADR-0029 rejects the shallow unification).
 *
 * The `Nível` row shows the FREE-PLAY level (Leve/Médio/Difícil), not the
 * engine tier's five-name ladder: the picker is the vocabulary this mode
 * teaches, and two difficulty vocabularies on one screen would compete.
 */
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
import type { Hint } from "../play/grid-hint";
import { nextHint } from "../play/grid-hint";
import { countFilled } from "../play/progress";
import screen from "../play/screen.module.css";
import { Board, BoardSkeleton } from "../sudoku/board";
import { playableGivens } from "../sudoku/engine";
import { Keypad, KeypadSkeleton } from "../sudoku/keypad";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
} from "../sudoku/state";
import boardStyles from "../sudoku/sudoku-board.module.css";
import { DEFAULT_FREE_PLAY_LEVEL, type FreePlayLevel } from "./catalog";
import styles from "./free-play.module.css";
import { LevelPicker } from "./level-picker";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeSudoku,
  type FreeSudokuDeps,
  type FreeSudokuPuzzle,
} from "./use-free-sudoku";

const ACCENT = accentVars("sudoku");

const TOTAL_CELLS = 81;

/** A readout placeholder's content — one line box, never zero height. */
const BLANK_READOUT = "\u00a0";

export function SudokuFreeScreen({
  deps,
}: {
  /** Test seam only; the page passes nothing. */
  readonly deps?: FreeSudokuDeps;
}) {
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

/** One puzzle's board, remounted per `{seed, level, run}` by its key. */
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
  const [hintKind, setHintKind] = useState<Hint<SudokuDigit>["kind"] | null>(
    null,
  );

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // The shipped "no stored record" path: `{now, hydrated: true}`, nothing
  // else. No `resume` ever — the timer stays inert (D8).
  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, []);

  const filled = countFilled(playableGivens(state.givens), state.entries);
  const hintReady =
    state.hint.used < state.hint.free && state.status === "playing";

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
    const current = stateRef.current;
    if (
      current.hint.used >= current.hint.free ||
      current.status !== "playing"
    ) {
      return;
    }
    // The solution comes narrowed from the generator output (use-free-sudoku
    // parses it once per puzzle) — no solver call needed (D7).
    const hint = nextHint(
      puzzle.solution,
      playableGivens(current.givens),
      current.entries,
    );
    if (hint === null) {
      return;
    }
    setHintKind(hint.kind);
    dispatch({ type: "use-hint", solution: puzzle.solution });
  }, [puzzle.solution]);

  if (state.status === "solved") {
    return <FreePlaySolvedCard game="sudoku" level={level} onAgain={onNext} />;
  }

  return (
    <Frame
      playState="playing"
      level={level}
      onLevelChange={onLevelChange}
      progressLong={messages.games.sudoku.play.progressLong(
        filled,
        TOTAL_CELLS,
      )}
      progressShort={messages.games.sudoku.play.progressShort(
        messages.freePlay.level[level],
        filled,
        TOTAL_CELLS,
      )}
      hint={{ ready: hintReady, onReveal: revealHint }}
      hintKind={hintKind}
    >
      <div className={screen.gridCard}>
        <Board
          givens={state.givens}
          entries={state.entries}
          selected={state.selected}
          violating={state.violating}
          hintIndex={state.hint.lastIndex}
          onSelect={selectCell}
          onMove={moveSelection}
          onDigit={enterDigit}
          onClear={clearCell}
        />
      </div>
      <Keypad onDigit={enterDigit} onClear={clearCell} />
    </Frame>
  );
}

/** The page chrome all three states share — see binairo-free-screen. */
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
  const copy = messages.games.sudoku.play;

  return (
    <main
      className={`${screen.page} ${boardStyles.pageSudoku}`}
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
        <span className={screen.barKicker}>{messages.games.sudoku.kicker}</span>
        <span className={screen.topDate}>{messages.freePlay.modeTag}</span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.sudoku.kicker}</p>
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

      {/* AFTER the board, and that is the whole of #67: `screen.page` places
          every child by NAMED GRID AREA, so this element's position in the
          source decides the tab order and decides nothing about the paint. It
          used to sit above `.board` while painting below it in both bands —
          bottom of the sidebar at >1140px, last row at <=1140px — so the
          second tab stop on this screen was the lowest control on the page
          (WCAG 2.4.3). Free play inherits the shared grid, so it inherited the
          defect and inherits the fix. `grid-area: hint` is unconditional in
          the shared sheet, so nothing about the layout moves with it.
          T-WEB-S231. */}
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

/** The board card at final dimensions, values blanked (D5's skeleton). */
function GeneratingBoard() {
  return (
    <>
      <div aria-hidden className={screen.gridCard}>
        <BoardSkeleton />
      </div>
      <KeypadSkeleton />
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
