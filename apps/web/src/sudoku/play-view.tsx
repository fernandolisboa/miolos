import type { SudokuTier } from "@miolos/games/sudoku";
import Link from "next/link";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { TimerReadout } from "../play/timer-readout";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
import { Keypad, KeypadSkeleton } from "./keypad";
import styles from "./sudoku-board.module.css";
import type { SudokuPlay } from "./use-sudoku-play";

const ACCENT = accentVars("sudoku");

const TOTAL_CELLS = 81;

const BLANK_READOUT = "\u00a0";

export function PlayView({
  play,
  archive,
}: {
  readonly play: SudokuPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;
  const copy = messages.games.sudoku.play;

  return (
    <main
      className={`${screen.page} ${styles.pageSudoku}`}
      style={ACCENT}
      data-play-state="playing"
    >
      <header className={screen.topBar}>
        <Link
          className={screen.back}
          href={archive?.back.href ?? routes.home}
          aria-label={archive?.back.ariaLabel ?? messages.play.backAria}
        >
          {archive?.back.label ?? messages.play.back}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>{messages.games.sudoku.kicker}</span>
        <span className={screen.topDate}>{formatLongDate(state.date)}</span>
        <TimerReadout className={screen.timerBar} elapsedMs={play.elapsed} />
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.sudoku.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>

          <span className={screen.progressBar}>
            {copy.progressShort(level(state.tier), play.filled, TOTAL_CELLS)}
          </span>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
        {archive === undefined ? null : (
          <p className={archive.note.className}>{archive.note.text}</p>
        )}
      </div>

      <div className={screen.statsCard}>
        <div aria-hidden className={screen.tape} />
        <div className={screen.statRow}>
          <span className={screen.statLabel}>{messages.play.timerLabel}</span>
          <TimerReadout className={screen.timerCard} elapsedMs={play.elapsed} />
        </div>
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          <span className={screen.progressCard}>
            {copy.progressLong(play.filled, TOTAL_CELLS)}
          </span>
        </div>

        <div className={screen.statRow}>
          <span className={screen.statLabel}>{copy.levelLabel}</span>
          <span className={styles.levelCard}>{level(state.tier)}</span>
        </div>
      </div>

      <section className={screen.board}>
        <div className={screen.gridCard}>
          <Board
            givens={state.givens}
            entries={state.entries}
            selected={state.selected}
            violating={state.violating}
            hintIndex={state.hint.lastIndex}
            onSelect={play.selectCell}
            onMove={play.moveSelection}
            onDigit={play.enterDigit}
            onClear={play.clearCell}
          />
        </div>
        <Keypad onDigit={play.enterDigit} onClear={play.clearCell} />
        {play.hintKind !== null && (
          <p className={screen.hintExplain}>
            {copy.hint.explain[play.hintKind]}
          </p>
        )}
      </section>

      <button
        type="button"
        className={`${screen.hint}${play.hintReady ? "" : ` ${screen.hintUsed}`}`}
        aria-disabled={!play.hintReady}
        onClick={play.revealHint}
      >
        {play.hintReady ? copy.hint.available : copy.hint.used}
      </button>
    </main>
  );
}

export function PlaySkeleton({
  date,
  tier,
  archive,
}: {
  readonly date: string;
  readonly tier: SudokuTier;
  readonly archive?: ArchivePlayChrome;
}) {
  const copy = messages.games.sudoku.play;

  return (
    <main
      className={`${screen.page} ${styles.pageSudoku}`}
      style={ACCENT}
      data-play-state="skeleton"
    >
      <header className={screen.topBar}>
        <Link
          className={screen.back}
          href={archive?.back.href ?? routes.home}
          aria-label={archive?.back.ariaLabel ?? messages.play.backAria}
        >
          {archive?.back.label ?? messages.play.back}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>{messages.games.sudoku.kicker}</span>
        <span className={screen.topDate}>{formatLongDate(date)}</span>
        <span aria-hidden className={screen.timerBar}>
          {BLANK_READOUT}
        </span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.sudoku.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
          <span aria-hidden className={screen.progressBar}>
            {BLANK_READOUT}
          </span>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
        {archive === undefined ? null : (
          <p className={archive.note.className}>{archive.note.text}</p>
        )}
      </div>

      <div aria-hidden className={screen.statsCard}>
        <div className={screen.tape} />
        <div className={screen.statRow}>
          <span className={screen.statLabel}>{messages.play.timerLabel}</span>
          <span className={screen.timerCard}>{BLANK_READOUT}</span>
        </div>
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          <span className={screen.progressCard}>{BLANK_READOUT}</span>
        </div>
        <div className={screen.statRow}>
          <span className={screen.statLabel}>{copy.levelLabel}</span>
          <span className={styles.levelCard}>{level(tier)}</span>
        </div>
      </div>

      <section className={screen.board}>
        <div aria-hidden className={screen.gridCard}>
          <BoardSkeleton />
        </div>
        <KeypadSkeleton />
      </section>

      <div
        aria-hidden
        className={`${screen.hint} ${screen.hintUsed} ${screen.placeholder}`}
      >
        {BLANK_READOUT}
      </div>
    </main>
  );
}

function level(tier: SudokuTier): string {
  return messages.games.sudoku.play.level(tier);
}
