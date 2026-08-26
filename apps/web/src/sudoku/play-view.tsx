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

/**
 * The shared layout's per-screen accent AND the ink that sits on an accent
 * fill, set inline because `play/screen.module.css` reads both throughout.
 * Ink-blue is only 2.00:1 against `--ink`, which is why the given/entered
 * distinction leans on the tint and the weight delta as well.
 *
 * The four geometry properties ride on `.pageSudoku` instead — a class this
 * module owns, so no cascade order is involved.
 */
const ACCENT = accentVars("sudoku");

const TOTAL_CELLS = 81;

/**
 * A readout placeholder's content. An EMPTY element has no line box at all
 * and collapses to zero height, so a blank clock would make the card it sits
 * in shorter than the one hydration puts there. A no-break space is one line
 * box in the element's own font — the reserved height therefore tracks a
 * token change by construction.
 */
const BLANK_READOUT = "\u00a0";

/**
 * The /sudoku play composition. There is no Sudoku reference frame: the chrome
 * is the shared `play/screen.module.css` (ADR-0029) — one CSS grid with named
 * areas carrying both viewports out of one DOM, because `display: contents`
 * cannot move a node across subtrees — and only the board, the keypad and the
 * `Nível` readout are this game's own.
 *
 * The three card rotations mirror Binairo's signs through `.pageSudoku`, so the
 * two screens read as different sheets from the same pad rather than as a copy.
 */
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
        {/* The <h1> is the FIRST element child of .titleRow, and the kicker
            is a sibling of the WRAPPER, never of the heading. That is not
            styling: impeccable's hero-eyebrow-chip and kicker-above-heading
            rules both anchor on `h1.previousElementSibling` and both return
            on their first guard when it is null (verified against
            node_modules/impeccable/cli/engine/rules/checks.mjs).
            Do not "simplify" the wrapper away. */}
        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
          {/* The mobile home of the `Nível` readout: the sidebar card is
              hidden ≤1140px, and a desktop-only difficulty would make the
              case for shipping `tier` over the wire half-true. */}
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
            {copy.progressLong(play.filled, TOTAL_CELLS)}
          </span>
        </div>
        {/* Sudoku's own third row: real signal a player can act on,
            from data that is already on the wire. */}
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
 * The pre-hydration paint. Everything the board, the clock, the progress
 * readout and the hint button show is DERIVED FROM THE RECORD, and the record
 * cannot be read before the mount effect — so painting them first renders a day
 * the player already finished as an empty board with a live hint button and a
 * 00:00 clock, for as long as hydration takes.
 *
 * What waits is the VALUES, never the boxes: every occupant of `.page`'s grid
 * and the keypad inside `.board` is reserved here at its shipped size,
 * because `.board` is a centred flex column and the mobile `hint` row is
 * `auto` — dropping either turns the freed height into an offset and the
 * largest element on the screen jumps upward the instant the mount effect
 * runs.
 *
 * `Nível` is the one readout that does NOT wait: the tier arrives on the wire
 * with the givens, so it owes the record nothing.
 */
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

      {/* The desktop sidebar card. Its THREE rows are what give it its
          height, so they are here in full — with the static labels, which say
          what the card is, and blank readouts where the record's numbers go. */}
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

      {/* Last in the source, exactly as in the live view above: the skeleton's
          placeholder is `aria-hidden` and unfocusable, so it owes nothing to
          the tab order itself — but the two branches occupy the same grid
          areas in the same source order, which is what the skeleton/live
          parity assertions read. Blank rather than labelled: which of
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

/** The tier's pt-BR name — `Fácil · Leve · Médio · Difícil · Puxado`. */
function level(tier: SudokuTier): string {
  return messages.games.sudoku.play.level(tier);
}
