import { MAX_GUESSES, normalizeWord } from "@miolos/games/termo";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import screen from "../play/screen.module.css";
import type { ArchivePlayChrome } from "../play/types";
import { Board, BoardSkeleton } from "./board";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import styles from "./termo-board.module.css";
import type { TermoPlay } from "./use-termo-play";

const ACCENT = accentVars("termo");

const BLANK_READOUT = " ";

const ZWSP = "​";

const INTERACTIVE_TARGET =
  'button, a[href], [role="button"], [tabindex], input, textarea, select, [contenteditable]';

const SINGLE_LETTER = /^[a-z]$/;

export function PlayView({
  play,
  archive,
}: {
  readonly play: TermoPlay;
  readonly archive?: ArchivePlayChrome;
}) {
  const { state } = play;
  const copy = messages.games.termo.play;
  const activeKeyRef = useRef<HTMLButtonElement | null>(null);

  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });

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
        event.preventDefault();
        current.erase();
        return;
      }

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
          href={archive?.back.href ?? routes.home}
          aria-label={archive?.back.ariaLabel ?? messages.play.backAria}
        >
          {archive?.back.label ?? messages.play.back}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>{messages.games.termo.kicker}</span>
        <span className={screen.topDate}>{formatLongDate(state.date)}</span>

        <span className={screen.progressBar}>
          {copy.progressShort(play.used, MAX_GUESSES)}
        </span>
      </header>

      <div className={screen.titleBlock}>
        <p className={screen.titleKicker}>{messages.games.termo.kicker}</p>

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
        {archive === undefined ? null : (
          <p className={archive.note.className}>{archive.note.text}</p>
        )}
      </div>

      <div className={screen.statsCard}>
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

        <div className={styles.noticeRow}>
          <p role="status" className={styles.notice}>
            {state.notice ?? BLANK_READOUT}

            <span className={styles.nonce}>
              {ZWSP.repeat(state.noticeNonce % 2)}
            </span>
          </p>

          {state.held ? (
            <button
              type="button"
              className={styles.noticeRetry}

              onClick={(event) => {
                play.retry();
                if (event.detail === 0) {
                  activeKeyRef.current?.focus();
                }
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

        <span className={styles.affordance}>{copy.keyboard.affordance}</span>

        <p role="status" className={styles.announcer}>
          {state.announcement}
        </p>
      </section>
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
          href={archive?.back.href ?? routes.home}
          aria-label={archive?.back.ariaLabel ?? messages.play.backAria}
        >
          {archive?.back.label ?? messages.play.back}
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

        <div className={screen.titleRow}>
          <h1 className={screen.title}>{copy.title}</h1>
        </div>
        <p className={screen.rules}>{copy.rules}</p>
        {archive === undefined ? null : (
          <p className={archive.note.className}>{archive.note.text}</p>
        )}
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
