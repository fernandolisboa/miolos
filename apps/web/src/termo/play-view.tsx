import { MAX_GUESSES, WORD_LENGTH } from "@miolos/games/termo";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import { BoardCard } from "../play/board-card";
import { isShortcut } from "../play/grid-selection";
import { InfoTip, InfoTipSkeleton } from "../play/info-tip";
import screen from "../play/screen.module.css";
import { typedLetter } from "../play/typed-letter";
import { Board, BoardSkeleton } from "./board";
import { Keyboard, KeyboardSkeleton } from "./keyboard";
import styles from "./termo-board.module.css";
import type { TermoChrome, TermoPlay } from "./types";

const ACCENT = accentVars("termo");

const BLANK_READOUT = " ";

const ZWSP = "​";

const PAGE_KEYS = new Set(["Home", "End"]);

const INTERACTIVE_TARGET =
  'button, a[href], [role="button"], [tabindex], input, textarea, select, [contenteditable]';

export function PlayView({
  play,
  chrome,
}: {
  readonly play: TermoPlay;
  readonly chrome?: TermoChrome;
}) {
  const { state } = play;
  const copy = messages.games.termo.play;
  const activeKeyRef = useRef<HTMLButtonElement | null>(null);

  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  });

  const onKey = useCallback((key: string) => {
    const current = playRef.current;
    return current.state.status === "playing" && pressKey(key, current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcut(event)) {
        return;
      }
      if (
        event.target instanceof Element &&
        event.target.closest(INTERACTIVE_TARGET) !== null
      ) {
        return;
      }
      if (PAGE_KEYS.has(event.key)) {
        return;
      }
      if (onKey(event.key) && event.key === "Backspace") {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onKey]);

  return (
    <main
      className={`${screen.page} ${styles.pageTermo}`}
      style={ACCENT}
      data-play-state="playing"
    >
      <header className={screen.topBar}>
        <Link
          className={screen.back}
          href={chrome?.back.href ?? routes.home}
          aria-label={chrome?.back.ariaLabel ?? messages.play.backAria}
        >
          {chrome?.back.label ?? messages.play.back}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>{messages.games.termo.kicker}</span>
        <span className={screen.topDate}>
          {chrome?.topTag ?? formatLongDate(state.date)}
        </span>

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
        {chrome?.note === undefined ? null : (
          <p className={chrome.note.className}>{chrome.note.text}</p>
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
        <BoardCard>
          <Board
            guesses={state.guesses}
            activeRow={play.activeRow}
            heldRow={play.heldRow}
            draft={state.draft}
            cursor={state.cursor}
            pending={state.pending}
            onSelect={play.select}
            onKey={onKey}
          />
        </BoardCard>

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

        <span className={styles.affordance}>
          <InfoTip text={copy.keyboard.affordance} align="center" />
        </span>

        <p role="status" className={styles.announcer}>
          {state.announcement}
        </p>
      </section>
    </main>
  );
}

function pressKey(key: string, play: TermoPlay): boolean {
  const { cursor } = play.state;
  switch (key) {
    case "Enter":
      play.submit();
      return true;
    case "Backspace":
    case "Delete":
      play.erase();
      return true;
    case "ArrowLeft":
      play.select(cursor - 1);
      return true;
    case "ArrowRight":
      play.select(cursor + 1);
      return true;
    case "Home":
      play.select(0);
      return true;
    case "End":
      play.select(WORD_LENGTH - 1);
      return true;
  }
  const letter = typedLetter(key);
  if (letter === null) {
    return false;
  }
  play.type(letter);
  return true;
}

export function PlaySkeleton({
  date,
  chrome,
}: {
  readonly date: string;
  readonly chrome?: TermoChrome;
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
          href={chrome?.back.href ?? routes.home}
          aria-label={chrome?.back.ariaLabel ?? messages.play.backAria}
        >
          {chrome?.back.label ?? messages.play.back}
        </Link>
        <span className={screen.wordmark}>{messages.brand.wordmark}</span>
        <span className={screen.barKicker}>{messages.games.termo.kicker}</span>
        <span className={screen.topDate}>
          {chrome?.topTag ?? formatLongDate(date)}
        </span>
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
        {chrome?.note === undefined ? null : (
          <p className={chrome.note.className}>{chrome.note.text}</p>
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
        <BoardCard placeholder>
          <BoardSkeleton />
        </BoardCard>

        <div aria-hidden className={styles.noticeRow}>
          <p className={styles.notice}>{BLANK_READOUT}</p>
        </div>

        <KeyboardSkeleton />

        <span className={styles.affordance}>
          <InfoTipSkeleton />
        </span>
      </section>
    </main>
  );
}
