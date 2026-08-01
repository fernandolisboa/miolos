import Link from "next/link";

import { formatLongDate, messages, routes } from "../i18n";
import styles from "./binairo-screen.module.css";
import { Controls } from "./controls";
import { Grid } from "./grid";
import { TimerReadout } from "./timer-readout";
import type { BinairoPlay } from "./use-binairo-play";

const TOTAL_CELLS = 64;

/**
 * The /binairo play composition (plan 017 §12.2), recreated from
 * f3-binairo-desktop and f4-binairo-mobile. One CSS grid with named areas
 * carries both viewports out of one DOM: `display: contents` cannot move a
 * node across subtrees (`.statsCard` is a grid item, `.topBar` its
 * sibling), so the readouts that appear in different places on the two
 * layouts exist twice and the module hides one of each pair.
 */
export function PlayView({ play }: { readonly play: BinairoPlay }) {
  const { state } = play;

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Link
          className={styles.back}
          href={routes.home}
          aria-label={messages.binairo.backAria}
        >
          {messages.binairo.back}
        </Link>
        <span className={styles.wordmark}>{messages.brand.wordmark}</span>
        <span className={styles.barKicker}>{messages.binairo.kicker}</span>
        <span className={styles.topDate}>{formatLongDate(state.date)}</span>
        <TimerReadout className={styles.timerBar} elapsedMs={play.elapsed} />
      </header>

      <div className={styles.titleBlock}>
        <p className={styles.titleKicker}>{messages.binairo.kicker}</p>
        {/* The <h1> is the FIRST element child of .titleRow, and the kicker
            is a sibling of the WRAPPER, never of the heading. That is not
            styling: impeccable's hero-eyebrow-chip and kicker-above-heading
            rules both anchor on `h1.previousElementSibling` and both return
            on their first guard when it is null (plan 017 §12.2, verified
            against node_modules/impeccable/cli/engine/rules/checks.mjs).
            Do not "simplify" the wrapper away. */}
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{messages.binairo.title}</h1>
          <span className={styles.progressBar}>
            {messages.binairo.progressShort(play.filled, TOTAL_CELLS)}
          </span>
        </div>
        <p className={styles.rules}>{messages.binairo.rules}</p>
      </div>

      <div className={styles.statsCard}>
        {/* Decoration with nothing to announce. */}
        <div aria-hidden className={styles.tape} />
        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            {messages.binairo.timerLabel}
          </span>
          <TimerReadout className={styles.timerCard} elapsedMs={play.elapsed} />
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>
            {messages.binairo.progressLabel}
          </span>
          <span className={styles.progressCard}>
            {messages.binairo.progressLong(play.filled, TOTAL_CELLS)}
          </span>
        </div>
      </div>

      {/* `aria-disabled` rather than `disabled`: the exhausted button stays
          focusable and keeps announcing why it does nothing (§10.5). */}
      <button
        type="button"
        className={`${styles.hint}${play.hintReady ? "" : ` ${styles.hintUsed}`}`}
        aria-disabled={!play.hintReady}
        onClick={play.revealHint}
      >
        {play.hintReady
          ? messages.binairo.hint.available
          : messages.binairo.hint.used}
      </button>

      <section className={styles.board}>
        <div className={styles.gridCard}>
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
          <p className={styles.hintExplain}>
            {messages.binairo.hint.explain[play.hintKind]}
          </p>
        )}
      </section>
    </main>
  );
}
