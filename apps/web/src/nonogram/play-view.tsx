import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import Link from "next/link";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { TimerReadout } from "../play/timer-readout";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
import { Controls, ControlsSkeleton } from "./controls";
import styles from "./nonogram-board.module.css";
import type { NonogramPlay } from "./use-nonogram-play";

const ACCENT = accentVars("nonogram");

const BLANK_READOUT = "\u00a0";

export function PlayView({
  play,
  archive,
}: {
  readonly play: NonogramPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;
  const copy = messages.games.nonogram.play;

  return (
    <main
      className={pageClassName(state.size)}
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
        <span className={screen.barKicker}>
          {messages.games.nonogram.kicker}
        </span>
        <span className={screen.topDate}>{formatLongDate(state.date)}</span>
        <TimerReadout className={screen.timerBar} elapsedMs={play.elapsed} />
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.nonogram.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>

          <span className={screen.progressBar}>
            {copy.progressShort(state.size, play.filled, play.target)}
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
            {copy.progressLong(play.filled, play.target)}
          </span>
        </div>

        <div className={screen.statRow}>
          <span className={screen.statLabel}>{copy.sizeLabel}</span>
          <span className={styles.sizeCard}>{copy.size(state.size)}</span>
        </div>
      </div>

      <section className={screen.board}>
        <div className={screen.gridCard}>
          <Board
            size={state.size}
            clues={state.clues}
            entries={state.entries}
            selected={state.selected}
            hintIndex={state.hint.lastIndex}
            onSelect={play.selectCell}
            onMove={play.moveSelection}
            onMarkCell={play.markCell}
            onEnterValue={play.enterValue}
            onClear={play.clearCell}
            onPaintOver={play.paintOver}
          />
        </div>
        <Controls brush={state.brush} onSetBrush={play.setBrush} />
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
  size,
  clues,
  archive,
}: {
  readonly date: string;
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
  readonly archive?: ArchivePlayChrome;
}) {
  const copy = messages.games.nonogram.play;

  return (
    <main
      className={pageClassName(size)}
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
        <span className={screen.barKicker}>
          {messages.games.nonogram.kicker}
        </span>
        <span className={screen.topDate}>{formatLongDate(date)}</span>
        <span aria-hidden className={screen.timerBar}>
          {BLANK_READOUT}
        </span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.nonogram.kicker}</p>

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
          <span className={screen.statLabel}>{copy.sizeLabel}</span>
          <span className={styles.sizeCard}>{copy.size(size)}</span>
        </div>
      </div>

      <section className={screen.board}>
        <div aria-hidden className={screen.gridCard}>
          <BoardSkeleton size={size} clues={clues} />
        </div>
        <ControlsSkeleton />
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

function pageClassName(size: NonogramSize): string {
  const cap = size === 5 ? ` ${styles.mobileCap5}` : "";
  return `${screen.page} ${styles.pageNonogram}${cap}`;
}
