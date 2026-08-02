import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import Link from "next/link";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { TimerReadout } from "../play/timer-readout";
import { Board, BoardSkeleton } from "./board";
import { Controls, ControlsSkeleton } from "./controls";
import styles from "./nonogram-board.module.css";
import type { NonogramPlay } from "./use-nonogram-play";

/**
 * The shared layout's per-screen accent AND the ink that sits on it, set
 * inline because `play/screen.module.css` reads both throughout. Terracotta
 * #B5563C: 4.32:1 against desk paper, which is what makes the filled cell read
 * as the picture with no rule at all — and why the caret is `--ink` rather
 * than the accent, since an accent caret on a filled cell would be 1:1 (§11.6).
 *
 * 4.32:1 IS BELOW WCAG AA FOR TEXT, and step-6 finding ISS-A2 measured it on
 * six surfaces. The pair split cleanly and both halves are now closed, neither
 * of them by moving a token value:
 *
 * - **Fixed here — desk ink ON a terracotta FILL.** `screen.hint` (14px/600)
 *   measured 4.318:1; `--ink-on-accent` resolves it to `--paper-card` at
 *   4.506:1, the identical one-token remedy `nonogram-board.module.css:461-463`
 *   already applies to `.controlActive`. Binairo and Sudoku resolve the same
 *   property to `--paper-desk` and are unchanged to the byte.
 * - **Fixed by #68, not here — terracotta TEXT on desk paper.** `.barKicker`
 *   and `.titleKicker` rendered at a computed **4.318:1** on `/nonogram` and —
 *   for `.barKicker` — on `/nonogram/concluido`, as did the conclusion's 17px
 *   `.chipDone .chipName` at **3.9717:1**. ADR-0041 closed all three without
 *   touching the palette: an accent may colour a shape, never a word, so the
 *   kickers are `--ink-2` (5.0791:1 on desk paper) and the chip name is
 *   `--ink` (13.8077:1 on the terracotta tint). The declarations live in the
 *   SHARED sheets — this module contributes only the `--accent` value they
 *   read (plan 020 landmine N14, dispositioned).
 *
 * **The rounding convention, stated once for the whole repo.** A composited
 * tint is computed at 8-bit precision and ROUNDED before its luminance is
 * taken, because that is what a browser paints: `color-mix(in srgb,
 * var(--accent) 10%, transparent)` over `--paper-card` #FBF7EF gives
 * (0.1x181 + 0.9x251, 0.1x86 + 0.9x247, 0.1x60 + 0.9x239) =
 * (244.0, 230.9, 221.1) -> **#F4E7DD**, L 0.81605382 — the same arithmetic
 * `conclusion-view.module.css`'s `.chipDone .chipName` block spells out for
 * mustard. This line used to quote **3.969:1**, the unrounded composite's
 * value, beside a **13.8077:1** taken from the rounded one; the rounded
 * figure is **3.9717:1** and it is what every number in this repo now uses
 * (step-7 finding A-F10). Neither value changes any conclusion — both are
 * below AA, which is why the declaration moved to `--ink`.
 *
 * `impeccable detect` in URL mode cannot see any of it, which is exactly why
 * the figures are written down.
 *
 * The geometry custom properties ride on `.pageNonogram` instead — a class
 * this module owns, so no cascade order is involved.
 */
const ACCENT = accentVars("nonogram");

/**
 * A readout placeholder's content. An EMPTY element has no line box at all and
 * collapses to zero height, so a blank clock would make the card it sits in
 * shorter than the one hydration puts there.
 */
const BLANK_READOUT = "\u00a0";

/**
 * The /nonogram play composition (plan 020 §11, §12). The chrome is the shared
 * `play/screen.module.css` (ADR-0029) — one CSS grid with named areas carrying
 * both viewports out of one DOM — and only the board, the brush row and the
 * `Tamanho` readout are this game's own.
 *
 * The three card rotations are a distinct signature from Binairo's and
 * Sudoku's through `.pageNonogram`, so the three screens read as different
 * sheets from the same pad rather than as copies.
 */
export function PlayView({ play }: { readonly play: NonogramPlay }) {
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
          href={routes.home}
          aria-label={messages.play.backAria}
        >
          {messages.play.back}
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
        {/* The <h1> is the FIRST element child of .titleRow, and the kicker is
            a sibling of the WRAPPER, never of the heading. That is not
            styling: impeccable's hero-eyebrow-chip and kicker-above-heading
            rules both anchor on `h1.previousElementSibling` and both return on
            their first guard when it is null. Do not "simplify" the wrapper
            away. */}
        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
          {/* The mobile home of the size readout: the sidebar card is hidden
              ≤1140px, and the board's dimensions are the one piece of
              per-day identity this game has. */}
          <span className={screen.progressBar}>
            {copy.progressShort(state.size, play.filled, play.target)}
          </span>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
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
          {/* The denominator is the PICTURE's cell count, summed from the
              clues — a `de size²` readout would stand at 21% at the moment a
              fill-only player wins (P13). */}
          <span className={screen.progressCard}>
            {copy.progressLong(play.filled, play.target)}
          </span>
        </div>
        {/* Nonogram's own third row, Sudoku's `Nível` slot exactly: real
            signal a player can act on, from data already on the wire. */}
        <div className={screen.statRow}>
          <span className={screen.statLabel}>{copy.sizeLabel}</span>
          <span className={styles.sizeCard}>{copy.size(state.size)}</span>
        </div>
      </div>

      {/* `aria-disabled` rather than `disabled`: the exhausted button stays
          focusable and keeps announcing why it does nothing. */}
      <button
        type="button"
        className={`${screen.hint}${play.hintReady ? "" : ` ${screen.hintUsed}`}`}
        aria-disabled={!play.hintReady}
        onClick={play.revealHint}
      >
        {play.hintReady ? copy.hint.available : copy.hint.used}
      </button>

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
    </main>
  );
}

/**
 * The pre-hydration paint (finding
 * `binairo-reload-flashes-a-blank-board-over-a-finished-day`). Everything the
 * board, the clock, the progress readout and the hint button show is DERIVED
 * FROM THE RECORD, and the record cannot be read before the mount effect — so
 * painting them first renders a day the player already finished as an empty
 * board with a live hint button and a 00:00 clock, for as long as hydration
 * takes.
 *
 * What waits is the VALUES, never the boxes: every occupant of `.page`'s grid
 * and the brush row inside `.board` is reserved here at its shipped size,
 * because `.board` is a centred flex column and the mobile `hint` row is
 * `auto` — dropping either turns the freed height into an offset and the
 * largest element on the screen jumps upward the instant the mount effect runs.
 *
 * `Tamanho` and the clue rails are the readouts that do NOT wait: the size and
 * the clues arrive on the wire with the puzzle, so they owe the record nothing
 * — and the rails sit in `max-content` tracks, so a blank one would reserve
 * the wrong width.
 */
export function PlaySkeleton({
  date,
  size,
  clues,
}: {
  readonly date: string;
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
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
          href={routes.home}
          aria-label={messages.play.backAria}
        >
          {messages.play.back}
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
        {/* The same structural wrapper as in PlayView — see the note there:
            impeccable's two rules anchor on `h1.previousElementSibling`. */}
        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
          <span aria-hidden className={screen.progressBar}>
            {BLANK_READOUT}
          </span>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
      </div>

      {/* The desktop sidebar card. Its THREE rows are what give it its height,
          so they are here in full — with the static labels, which say what the
          card is, and blank readouts where the record's numbers go. */}
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
          <BoardSkeleton size={size} clues={clues} />
        </div>
        <ControlsSkeleton />
      </section>
    </main>
  );
}

/**
 * The page root's classes. `.mobileCap5` rides on the SAME element as
 * `.pageNonogram` when the day is a 5×5, because the mobile cap is per SIZE:
 * a single 350px value would wrap a 350px card around a 288px board at 390px,
 * ~31px of dead paper each side, on the one screen whose whole argument is
 * paper that hugs its board (§12.4). Custom properties inherit, so the brush
 * row resolves the same cap — deliberately, and the arithmetic holds for both.
 */
function pageClassName(size: NonogramSize): string {
  const cap = size === 5 ? ` ${styles.mobileCap5}` : "";
  return `${screen.page} ${styles.pageNonogram}${cap}`;
}
