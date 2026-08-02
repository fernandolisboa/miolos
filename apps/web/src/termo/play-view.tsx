import { MAX_GUESSES, normalizeWord } from "@miolos/games/termo";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import { Board, BoardSkeleton } from "./board";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import styles from "./termo-board.module.css";
import type { TermoPlay } from "./use-termo-play";

/**
 * The shared layout's per-screen accent AND the ink that sits on it, set
 * inline because `play/screen.module.css` reads both throughout.
 *
 * Mustard #C08A1E is the worst of the four accents and no paper rescues it:
 * 2.7311:1 on `--paper-desk`, 2.8501:1 on `--paper-card`, 2.5457:1 on
 * `--paper-tint`, against a 4.5 floor for text and a 3:1 floor for a
 * state-bearing boundary. `--ink-on-accent` resolves to `var(--ink)` for
 * termo — 5.4968:1 ON the mustard fill — which is what makes the `correct`
 * tile and the `correct` key legible, and ADR-0041 is why no word and no
 * boundary on this screen is mustard at all. Every figure here is computed
 * (§12.2), because `low-contrast` is wildcard-ignored on every host CI scans
 * and a green detect run is not evidence.
 *
 * The four geometry custom properties ride on `.pageTermo` instead — a class
 * this module owns, so no cascade order is involved.
 */
const ACCENT = accentVars("termo");

/**
 * A readout placeholder's content. An EMPTY element has no line box at all
 * and collapses to zero height, so a blank slot would make the box it sits in
 * shorter than the one hydration puts there. The NAMED constant rather than
 * an inline literal, so the reserved line box cannot be lost to a
 * "simplification" that types a plain space — which collapses.
 */
const BLANK_READOUT = " ";

/**
 * Zero advance, never verbalised by NVDA, JAWS or VoiceOver — and still a
 * real DOM mutation inside an aria-atomic region, which is the whole job
 * (§13.1b item 6b).
 */
const ZWSP = "​";

/**
 * The interactive-target bail for the window keydown listener (§12.4, ADR-0042
 * decision 4). The listener serves the UNFOCUSED page, so the instant
 * anything on the page holds focus that element's own semantics own the
 * keystroke.
 *
 * `closest()` rather than a tag test, because the event target inside a
 * `<button>` can be a text node's parent span. `[tabindex]` rather than
 * `[tabindex="0"]`, because the roving keyboard gives 27 of its 28 keys
 * `tabindex="-1"` and a programmatically focused one is just as much a live
 * target.
 */
const INTERACTIVE_TARGET =
  'button, a[href], [role="button"], [tabindex], input, textarea, select, [contenteditable]';

/** One letter, after `normalizeWord`. `ç` is `c` and `á` is `a` (AC 2). */
const SINGLE_LETTER = /^[a-z]$/;

/**
 * The /termo play composition (plan 022 §12, §13.2). The chrome is the shared
 * `play/screen.module.css` (ADR-0029) — one CSS grid with named areas
 * carrying both viewports out of one DOM — and only the board, the notice
 * row and the keyboard are this game's own.
 *
 * NO `<TimerReadout/>` and no hint button: ADR-0045 decisions 1 and 4. The
 * clock runs and is recorded; it is not rendered, so `/termo` is not a fourth
 * surface for the #63 digit-swing defect, and a Termo elapsed time — which
 * includes every per-guess round trip — is never presented as a result.
 */
export function PlayView({ play }: { readonly play: TermoPlay }) {
  const { state } = play;
  const copy = messages.games.termo.play;
  const activeKeyRef = useRef<HTMLButtonElement | null>(null);

  // Event handlers need the CURRENT play without re-registering the listener
  // on every keystroke; a ref synced each commit is the repo's own idiom
  // (`use-termo-play.ts`'s `stateRef`, `nonogram/board.tsx`'s
  // `consumedClickRef`).
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });

  /**
   * The physical keyboard, `window`-scoped and torn down on unmount. A Termo
   * player expects to type the instant the page paints, without clicking
   * anything, so a container listener would be dead until something took
   * focus — which is why ADR-0030 decision 3's board-container rule is scoped
   * to grid games and this is a fresh decision (ADR-0042 decision 4).
   *
   * GUARD 3 IS BLOCKING, NOT TIDYING. Without it a focused key receiving
   * `Enter` is handled twice — this listener submits AND the browser's
   * synthesised click types that letter into the row the submit just consumed;
   * `Enter` on `enviar` posts the same guess twice; `Enter` on "← Hoje"
   * spends a turn while navigating away from the board that would have shown
   * the verdict. And it is the NORMAL path for assistive technology: NVDA and
   * JAWS stay in browse mode on a `<button>` and activate it with `Enter`, so
   * without the bail a screen-reader user submits after every single letter
   * and the game is unplayable for the exact audience §13 is written for.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = playRef.current;
      if (current.state.status !== "playing") {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest(INTERACTIVE_TARGET) !== null
      ) {
        return;
      }
      if (event.key === "Enter") {
        current.submit();
        return;
      }
      if (event.key === "Backspace") {
        // A history-back gesture in some browsers — `nonogram/board.tsx`
        // carries the same note for the same key.
        event.preventDefault();
        current.erase();
        return;
      }
      // AC 2 applied to the KEYSTROKE, not only to the comparison: an ABNT2
      // player who types `á` or `ç` out of habit gets `a` and `c` rather than
      // a dead key, through the engine's one normalization function.
      const letter = normalizeWord(event.key);
      if (SINGLE_LETTER.test(letter)) {
        current.type(letter);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <main
      className={`${screen.page} ${styles.pageTermo}`}
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
        <span className={screen.barKicker}>{messages.games.termo.kicker}</span>
        <span className={screen.topDate}>{formatLongDate(state.date)}</span>
        {/* Termo's third bar slot, where the three shipped screens put the
            timer. Without it `justify-content: space-between` has TWO items
            below 1140px and throws PALAVRAS hard right, where three shipped
            screens centre it — and a Termo-only override is impossible,
            because CSS Modules hash per file. `display: none` above 1140px,
            so the desktop bar is back · wordmark · date exactly as shipped,
            and the stats card keeps `.progressCard` as the desktop home of
            the same number. */}
        <span className={screen.progressBar}>
          {copy.progressShort(play.used, MAX_GUESSES)}
        </span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.termo.kicker}</p>
        {/* The <h1> is the FIRST element child of .titleRow, and the kicker is
            a sibling of the WRAPPER, never of the heading. That is not
            styling: impeccable's hero-eyebrow-chip and kicker-above-heading
            rules both anchor on `h1.previousElementSibling` and both return
            on their first guard when it is null. Do not "simplify" the
            wrapper away. The <h1> is ALONE here — `.progressBar` is Termo's
            top-bar slot, not the title row's. */}
        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
      </div>

      {/* ONE row, not three. Sudoku has `Nível` and Nonogram `Tamanho`
          because both have a per-day parameter on the wire; termo's public
          projection is `game, date` only, so there is nothing honest to put
          there — and the timer row is gone under ADR-0045 decision 4. The
          card is shorter, and that is correct rather than unfinished. */}
      <div className={screen.statsCard}>
        {/* Decoration with nothing to announce. */}
        <div aria-hidden className={screen.tape} />
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          <span className={screen.progressCard}>
            {copy.progressLong(play.used, MAX_GUESSES)}
          </span>
        </div>
      </div>

      <section className={screen.board}>
        <div className={screen.gridCard}>
          <Board
            guesses={state.guesses}
            activeRow={play.activeRow}
            heldRow={play.heldRow}
            draft={state.draft}
            pending={state.pending}
          />
        </div>

        {/* Reserved at its TALLEST state and ALWAYS rendered — a row that
            appeared would be a layout shift. The two `role="status"` regions
            are safe because NO REDUCER TRANSITION WRITES BOTH (§13.1b), not
            because their paths happen not to overlap. */}
        <div className={styles.noticeRow}>
          <p role="status" className={styles.notice}>
            {state.notice ?? BLANK_READOUT}
            {/* NOT aria-hidden: an aria-hidden mutation is invisible to the
                live region, and forcing a re-read of an identical string is
                the entire job. A SIBLING span, so the notice's own text node
                is untouched and `getByText()` still matches exactly. */}
            <span className={styles.nonce}>
              {ZWSP.repeat(state.noticeNonce % 2)}
            </span>
          </p>
          {/* ADR-0039's retry — held branch only, OUTSIDE the live region so
              the region's atomic re-read is the sentence alone and no
              focusable element sits inside a mutating one. It hands the caret
              to the keyboard SYNCHRONOUSLY because it is about to unmount,
              and a focused element that unmounts drops the caret to <body>
              mid-game (a 2.4.3 failure). This is the ONLY place focus moves
              programmatically on this screen. */}
          {state.held ? (
            <button
              type="button"
              className={styles.noticeRetry}
              onClick={() => {
                play.retry();
                activeKeyRef.current?.focus();
              }}
            >
              {copy.retry}
            </button>
          ) : null}
        </div>

        <Keyboard
          state={play.keyboardState}
          onLetter={play.type}
          onEnter={play.submit}
          onErase={play.erase}
          activeKeyRef={activeKeyRef}
        />

        {/* Desktop-only, and a SIBLING of the keyboard — never a child.
            `.keyboard` is a 20-column grid with all 28 keys explicitly
            placed, so an unplaced span auto-places into an implicit fourth
            row one column wide, and `margin-top` on a grid item is inert
            against `gap` besides. Moving it out also keeps a decorative
            sentence out of the `role="group"` labelled `teclado`. */}
        <span className={styles.affordance}>{copy.keyboard.affordance}</span>

        <p role="status" className={styles.announcer}>
          {state.announcement}
        </p>
      </section>
    </main>
  );
}

/**
 * The pre-hydration paint. Everything the board, the notice and the progress
 * readout show is DERIVED FROM THE RECORD, and the record cannot be read
 * before the mount effect — so painting them first renders a day the player
 * already finished as an empty board, for as long as hydration takes.
 *
 * What waits is the VALUES, never the boxes: the 30 tiles, the whole
 * `.noticeRow` at its full 36px (the height it holds in every play state
 * INCLUDING the held one, so the retry button appearing is a paint and never
 * a reflow), all three keyboard rows and all 28 key boxes, the `.affordance`
 * line as a SIBLING so its 13px line box is reserved too, the one-row stats
 * card, and the `.progressBar` slot in the top bar — that last one so the
 * ≤1140px bar keeps THREE children before hydration and `space-between` does
 * not throw the kicker from hard-right to centre on hydrate.
 */
export function PlaySkeleton({ date }: { readonly date: string }) {
  const copy = messages.games.termo.play;

  return (
    <main
      className={`${screen.page} ${styles.pageTermo}`}
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
        <span className={screen.barKicker}>{messages.games.termo.kicker}</span>
        <span className={screen.topDate}>{formatLongDate(date)}</span>
        <span aria-hidden className={screen.progressBar}>
          {BLANK_READOUT}
        </span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.termo.kicker}</p>
        {/* The same structural wrapper as in PlayView — see the note there. */}
        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
      </div>

      <div aria-hidden className={screen.statsCard}>
        <div className={screen.tape} />
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          <span className={screen.progressCard}>{BLANK_READOUT}</span>
        </div>
      </div>

      <section className={screen.board}>
        <div aria-hidden className={screen.gridCard}>
          <BoardSkeleton />
        </div>

        <div aria-hidden className={styles.noticeRow}>
          <p className={styles.notice}>{BLANK_READOUT}</p>
        </div>

        <KeyboardSkeleton />

        <span aria-hidden className={styles.affordance}>
          {copy.keyboard.affordance}
        </span>
      </section>
    </main>
  );
}
