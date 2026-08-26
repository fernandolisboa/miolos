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

/**
 * The shared layout's per-screen accent AND the ink that sits on it, set
 * inline because `play/screen.module.css` reads both throughout. Terracotta
 * #B5563C: 4.32:1 against desk paper, which is what makes the filled cell read
 * as the picture with no rule at all — and why the caret is `--ink` rather
 * than the accent, since an accent caret on a filled cell would be 1:1.
 *
 * ADR-0041 measures every terracotta figure this screen depends on, and
 * `accent-contrast.test.ts` recomputes them from `packages/ui/tokens.css` on
 * every gate run.
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
 * The /nonogram play composition. The chrome is the shared
 * `play/screen.module.css` (ADR-0029) — one CSS grid with named areas carrying
 * both viewports out of one DOM — and only the board, the brush row and the
 * `Tamanho` readout are this game's own.
 *
 * The three card rotations are a distinct signature from Binairo's and
 * Sudoku's through `.pageNonogram`, so the three screens read as different
 * sheets from the same pad rather than as copies.
 */
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
        {archive === undefined ? null : (
          <p className={archive.note.className}>{archive.note.text}</p>
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
          {/* The denominator is the PICTURE's cell count, summed from the
              clues — a `de size²` readout would stand at 21% at the moment a
              fill-only player wins. */}
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

      {/* AFTER the board: `screen.page` places every child by NAMED GRID
          AREA, so this element's position in the source decides the tab
          order and decides nothing about the paint. T-WEB-S232.

          `aria-disabled` rather than `disabled`: the exhausted button stays
          focusable and keeps announcing why it does nothing. */}
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

/**
 * The pre-hydration paint. Everything the
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
        {/* The same structural wrapper as in PlayView — see the note there:
            impeccable's two rules anchor on `h1.previousElementSibling`. */}
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

      <section className={screen.board}>
        <div aria-hidden className={screen.gridCard}>
          <BoardSkeleton size={size} clues={clues} />
        </div>
        <ControlsSkeleton />
      </section>

      {/* Last in the source, exactly as in the live view above: the skeleton's
          placeholder is `aria-hidden` and unfocusable, so it owes nothing to
          the tab order itself — but the two branches occupy the same grid
          areas in the same source order, which is what the skeleton/live
          parity assertions read (#67). Blank rather than labelled: which of
          the two hint labels applies is read off the record, and the bar is
          the same 44px/50px either way. */}
      <div
        aria-hidden
        className={`${screen.hint} ${screen.hintUsed} ${screen.placeholder}`}
      >
        {BLANK_READOUT}
      </div>
    </main>
  );
}

/**
 * The page root's classes. `.mobileCap5` rides on the SAME element as
 * `.pageNonogram` when the day is a 5×5, because the mobile cap is per SIZE:
 * a single 350px value would wrap a 350px card around a 288px board at 390px,
 * ~31px of dead paper each side, on the one screen whose whole argument is
 * paper that hugs its board. Custom properties inherit, so the brush
 * row resolves the same cap — deliberately, and the arithmetic holds for both.
 */
function pageClassName(size: NonogramSize): string {
  const cap = size === 5 ? ` ${styles.mobileCap5}` : "";
  return `${screen.page} ${styles.pageNonogram}${cap}`;
}
