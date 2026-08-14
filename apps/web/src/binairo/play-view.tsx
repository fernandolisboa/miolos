import Link from "next/link";

import { formatLongDate, messages, routes } from "../i18n";
import type { ArchivePlayChrome } from "../archive/chrome";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { TimerReadout } from "../play/timer-readout";
import styles from "./binairo-screen.module.css";
import { Controls } from "./controls";
import { Grid } from "./grid";
import type { BinairoPlay } from "./use-binairo-play";

/**
 * The shared layout's per-screen accent AND the ink that sits on an accent
 * fill, set inline because `play/screen.module.css` reads both throughout
 * (plan 018 §5.2). Moss-green resolves `--ink-on-accent` to the same
 * `var(--paper-desk)` this screen has always painted — 5.307:1 on `.hint`,
 * unchanged to the byte by #25's ISS-A2 fix, which moves Nonogram only.
 * The four geometry properties ride on `.pageBinairo` instead — a class this
 * module owns, so no cascade order is involved (§12.2).
 */
const ACCENT = accentVars("binairo");

const TOTAL_CELLS = 64;

/**
 * A readout placeholder's content. An EMPTY element has no line box at all
 * and collapses to zero height, so a blank clock would make the card it sits
 * in shorter than the one hydration puts there. A no-break space is one line
 * box in the element's own font — the reserved height therefore tracks a
 * token change by construction, where a hard-coded pixel value would not
 * (finding `play-skeleton-is-not-at-final-dimensions`).
 */
const BLANK_READOUT = "\u00a0";

/**
 * The /binairo play composition (plan 017 §12.2), recreated from
 * f3-binairo-desktop and f4-binairo-mobile. The chrome comes from the shared
 * `play/screen.module.css` (ADR-0029): one CSS grid with named areas carries
 * both viewports out of one DOM, because `display: contents` cannot move a
 * node across subtrees (`.statsCard` is a grid item, `.topBar` its sibling)
 * — so the readouts that appear in different places on the two layouts exist
 * twice and the sheet hides one of each pair. Only the board and the control
 * row are this game's own.
 *
 * **The archive's optional chrome** (#31, ADR-0053 decision 9): ABSENT — every
 * daily route — this renders exactly what it always did, byte for byte, and
 * T-WEB-S185 pins both directions. Present, the back affordance becomes the
 * archived day's and one extra rules line states that the day does not move
 * the streak.
 */
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
        {/* The <h1> is the FIRST element child of .titleRow, and the kicker
            is a sibling of the WRAPPER, never of the heading. That is not
            styling: impeccable's hero-eyebrow-chip and kicker-above-heading
            rules both anchor on `h1.previousElementSibling` and both return
            on their first guard when it is null (plan 017 §12.2, verified
            against node_modules/impeccable/cli/engine/rules/checks.mjs).
            Do not "simplify" the wrapper away. */}
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
        {/* #31 (ADR-0053 decision 9): the archive's ONE added line, a second
            `screen.rules` paragraph under the game's own — already `--ink-2`,
            already shipped, so no stylesheet is edited. It is what makes the
            archive's semantics visible to the person they apply to, which a
            mode chip could not have said. */}
        {archive === undefined ? null : (
          <p className={screen.rules}>{archive.note}</p>
        )}
      </div>

      <div className={screen.statsCard}>
        {/* Decoration with nothing to announce. */}
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

      {/* `aria-disabled` rather than `disabled`: the exhausted button stays
          focusable and keeps announcing why it does nothing (§10.5). */}
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
    </main>
  );
}

/**
 * The pre-hydration paint (§12.2, finding
 * `binairo-reload-flashes-a-blank-board-over-a-finished-day`). Everything
 * the board, the clock, the progress readout and the hint button show is
 * DERIVED FROM THE RECORD, and the record cannot be read before the mount
 * effect — so painting them first renders a day the player already finished
 * as an empty board with a live hint button and a 00:00 clock, for as long
 * as hydration takes. The conclusion route already made this trade (D28:
 * "a beat of nothing" beats a wrong first paint); this is the same trade on
 * the play route.
 *
 * What waits is the VALUES, never the boxes. Every occupant of `.page`'s
 * grid — the stats card, the hint bar — and the control row inside `.board`
 * is reserved here at its shipped size, because `.board` is a centred flex
 * column and the mobile `hint` row is `auto`: dropping either turns the
 * freed height into an offset and the largest element on the screen jumps
 * upward the instant the mount effect runs (finding
 * `play-skeleton-is-not-at-final-dimensions`, measured at −71.7px on a
 * 390×844 phone, held for ~1.6s on a throttled connection). With them
 * reserved, `.gridCard`'s bounding-box top is identical in the JS-disabled
 * paint and in the settled page at 1440×900, 390×844 and 320×640.
 *
 * The placeholders are `aria-hidden` divs, never buttons: a focusable
 * control with no handler behind it is worse than none, and the board's own
 * placeholder reuses `.gridCard`, `.grid` and `.cell` so its size comes from
 * the shipped rules by construction rather than from a copied number.
 *
 * One thing does still move, and it is named here rather than glossed: on
 * mobile `.topBar` is `justify-content: space-between`, the clock's box is
 * blank because its VALUE is the record's, and a blank box is 4.4px wide
 * against `00:00`'s 56.9px — so `.barKicker` beside it settles ~25px left.
 * Pinning that would take a hard-coded `min-width` on the shipped rule, for
 * an 11px label; the board, the stats card, the hint bar and the control row
 * all land on the same pixel in both paints.
 *
 * **The archive's optional chrome** (#31, ADR-0053 decision 9): ABSENT — every
 * daily route — this renders exactly what it always did, byte for byte, and
 * T-WEB-S185 pins both directions. Present, the back affordance becomes the
 * archived day's and one extra rules line states that the day does not move
 * the streak.
 */
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
        {/* The same structural wrapper as in PlayView — see the note there:
            impeccable's two rules anchor on `h1.previousElementSibling`. */}
        <div className={screen.titleRow}>
          <h1 className={screen.title}>{messages.games.binairo.play.title}</h1>
          <span aria-hidden className={screen.progressBar}>
            {BLANK_READOUT}
          </span>
        </div>
        <p className={screen.rules}>{messages.games.binairo.play.rules}</p>
        {/* #31 (ADR-0053 decision 9): the archive's ONE added line, a second
            `screen.rules` paragraph under the game's own — already `--ink-2`,
            already shipped, so no stylesheet is edited. It is what makes the
            archive's semantics visible to the person they apply to, which a
            mode chip could not have said. */}
        {archive === undefined ? null : (
          <p className={screen.rules}>{archive.note}</p>
        )}
      </div>

      {/* The desktop sidebar card. Its two rows are what give it its height,
          so they are here in full — with the STATIC labels, which say what
          the card is, and blank readouts where the record's numbers go. */}
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

      {/* Blank rather than labelled: which of the two hint labels applies is
          read off the record, and the bar is the same 44px/50px either way. */}
      <div
        aria-hidden
        className={`${screen.hint} ${screen.hintUsed} ${screen.placeholder}`}
      >
        {BLANK_READOUT}
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
        {/* Labelled, unlike the readouts above: the control row shows the
            mode, `PaintMode` is never persisted, and `initPlayState` always
            starts in cycle — so this row is the ONE piece of play chrome
            that owes the record nothing and can paint complete. Divs, so
            nothing here is focusable or announced before it works. */}
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
    </main>
  );
}
