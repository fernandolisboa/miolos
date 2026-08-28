import Link from "next/link";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { TimerReadout } from "../play/timer-readout";
import type { ArchivePlayChrome } from "../play/types";
import styles from "./binairo-screen.module.css";
import { Controls } from "./controls";
import { Grid } from "./grid";
import type { BinairoPlay } from "./use-binairo-play";

const ACCENT = accentVars("binairo");

const TOTAL_CELLS = 64;

const BLANK_READOUT = "\u00a0";

export function PlayView({
  play,
  archive,
}: {
  readonly play: BinairoPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;

  return (
    <main
      className={`${screen.page} ${styles.pageBinairo}`}
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
          {messages.games.binairo.kicker}
        </span>
        <span className={screen.topDate}>{formatLongDate(state.date)}</span>
        <TimerReadout className={screen.timerBar} elapsedMs={play.elapsed} />
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.binairo.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{messages.games.binairo.play.title}</h1>
          <span className={screen.progressBar}>
            {messages.games.binairo.play.progressShort(
              play.filled,
              TOTAL_CELLS,
            )}
          </span>
        </div>
        <p className={screen.rules}>{messages.games.binairo.play.rules}</p>
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
            {messages.games.binairo.play.progressLong(play.filled, TOTAL_CELLS)}
          </span>
        </div>
      </div>

      <section className={screen.board}>
        <div className={screen.gridCard}>
          <Grid
            givens={state.givens}
            entries={state.entries}
            violating={state.violating}
            hintIndex={state.hint.lastIndex}
            painting={state.paint.kind !== "cycle"}
            onTap={play.tapCell}
            onPaintOver={play.paintOver}
          />
        </div>
        <Controls paint={state.paint} onToggleMode={play.toggleMode} />
        {play.hintKind !== null && (
          <p className={screen.hintExplain}>
            {messages.games.binairo.play.hint.explain[play.hintKind]}
          </p>
        )}
      </section>

      <button
        type="button"
        className={`${screen.hint}${play.hintReady ? "" : ` ${screen.hintUsed}`}`}
        aria-disabled={!play.hintReady}
        onClick={play.revealHint}
      >
        {play.hintReady
          ? messages.games.binairo.play.hint.available
          : messages.games.binairo.play.hint.used}
      </button>
    </main>
  );
}

export function PlaySkeleton({
  date,
  archive,
}: {
  readonly date: string;
  readonly archive?: ArchivePlayChrome;
}) {
  return (
    <main
      className={`${screen.page} ${styles.pageBinairo}`}
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
          {messages.games.binairo.kicker}
        </span>
        <span className={screen.topDate}>{formatLongDate(date)}</span>
        <span aria-hidden className={screen.timerBar}>
          {BLANK_READOUT}
        </span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.binairo.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{messages.games.binairo.play.title}</h1>
          <span aria-hidden className={screen.progressBar}>
            {BLANK_READOUT}
          </span>
        </div>
        <p className={screen.rules}>{messages.games.binairo.play.rules}</p>
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
      </div>

      <section className={screen.board}>
        <div aria-hidden className={screen.gridCard}>
          <div className={styles.grid}>
            {Array.from({ length: TOTAL_CELLS }, (_unused, index) => (
              <div
                key={index}
                className={`${styles.cell} ${styles.cellSkeleton}`}
              />
            ))}
          </div>
        </div>

        <div aria-hidden className={styles.controls}>
          <div
            className={`${styles.control} ${styles.controlDigit} ${styles.placeholder}`}
          >
            {messages.games.binairo.play.controls.zero}
          </div>
          <div
            className={`${styles.control} ${styles.controlDigit} ${styles.placeholder}`}
          >
            {messages.games.binairo.play.controls.one}
          </div>
          <div
            className={`${styles.control} ${styles.controlErase} ${styles.placeholder}`}
          >
            {messages.games.binairo.play.controls.erase}
          </div>
          <span className={styles.affordance}>
            {messages.games.binairo.play.controls.affordance}
          </span>
        </div>
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
