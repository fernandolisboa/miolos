"use client";

/**
 * The /modo-livre/binairo screen (#28, ADR-0046): the daily play screen's
 * sibling, not a new dialect — same shared grid chrome, same board card,
 * same hint bar — with the free-play differences of plan 025 §7.2: back
 * targets the index, the date slot carries the mode label, NO timer
 * (decision 6), a three-chip level picker above the board, and an in-place
 * swap to the solved card offering "Mais um".
 *
 * Free play records NOTHING: no lifecycle hook, no sync, no play record,
 * no localStorage (ADR-0008 rule 5, ADR-0046 decision 4). The ESLint wall
 * around this directory makes those imports a lint error, and the
 * zero-fetch suites prove the absence at runtime.
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

/** A readout placeholder's content — one line box, never zero height. */
const BLANK_READOUT = "\u00a0";

export function BinairoFreeScreen({
  deps,
}: {
  /** Test seam only; the page passes nothing. */
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

/**
 * One puzzle's board, remounted per `{seed, level, run}` by its key —
 * React's own reset semantics instead of a hand-rolled reset action. The
 * daily reducer is reused UNMODIFIED: the timer stays `{accumulatedMs: 0,
 * runningSince: null}` forever because no `resume` is ever dispatched —
 * inert state, not removed state (plan 025 D8).
 */
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

  // The shipped path for "no stored record" (binairo/state.ts `restore`):
  // sets `{now, hydrated: true}` and nothing else. Free play has no record
  // to look for, so this is the whole of hydration (plan 025 §6.2).
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
    // The solution comes from the generator output, not a solver memo —
    // the one line where free play diverges from `use-binairo-play` (D7).
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

/**
 * The page chrome all three states share — the shared play grid with the
 * free-play differences (§7.2). `children` fills the board slot: the grid
 * card and controls while playing, the reserved skeleton while generating,
 * the error card on failure.
 */
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
  /** `null` renders the reserved placeholder bar (the skeleton discipline). */
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
        {/* The date slot carries the MODE, because free play has no date —
            and no timer readout in either position (D8). */}
        <span className={screen.topDate}>{messages.freePlay.modeTag}</span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.binairo.kicker}</p>
        {/* The <h1> stays the FIRST element child of .titleRow — see the
            daily play-view: impeccable's hero-eyebrow-chip and
            kicker-above-heading rules anchor on `h1.previousElementSibling`. */}
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
        {/* The level in the timer's old slot: free play measures nothing
            (D8), and the level is the one per-puzzle identity this mode
            has. */}
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
        <div className={boardStyles.grid}>
          {Array.from({ length: TOTAL_CELLS }, (_unused, index) => (
            <div
              key={index}
              className={`${boardStyles.cell} ${boardStyles.cellSkeleton}`}
            />
          ))}
        </div>
      </div>
      {/* Static text, no spinner: a synchronous generation burst would
          freeze an animation, and the system prefers stillness (D5). */}
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
