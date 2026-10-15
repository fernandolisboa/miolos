import { MAX_GUESSES, WORD_LENGTH } from "@miolos/games/termo";
import Link from "next/link";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

import { Wordmark } from "../components/brand-mark";
import { formatLongDate, messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import { BoardCard } from "../play/board-card";
import { isShortcut } from "../play/grid-selection";
import { InfoTip, InfoTipSkeleton } from "../play/info-tip";
import { PlayTitle } from "../play/play-title";
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

const DAILY_CHROME: TermoChrome = {
  back: {
    href: routes.home,
    label: messages.play.back,
    ariaLabel: messages.play.backAria,
  },
};

function TermoHeading({
  chrome,
  date,
  progress,
}: {
  readonly chrome: TermoChrome;
  readonly date: string;
  readonly progress: string | null;
}) {
  const copy = messages.games.termo.play;

  return (
    <>
      <header className={screen.topBar}>
        <Link
          className={screen.back}
          href={chrome.back.href}
          aria-label={chrome.back.ariaLabel}
        >
          {chrome.back.label}
        </Link>
        <Wordmark className={screen.wordmark} />
        {chrome.picker ?? (
          <span className={screen.barKicker}>
            {messages.games.termo.kicker}
          </span>
        )}
        <span className={screen.topDate}>
          {chrome.topTag ?? formatLongDate(date)}
        </span>
        {progress === null ? (
          <span aria-hidden className={screen.progressBar}>
            {BLANK_READOUT}
          </span>
        ) : (
          <span className={screen.progressBar}>{progress}</span>
        )}
      </header>

      <PlayTitle
        kicker={messages.games.termo.kicker}
        title={copy.title}
        rules={chrome.rules ?? copy.rules}
        note={chrome.note ?? null}
        inert={progress === null}
      />
    </>
  );
}

export function TermoPage({
  chrome,
  date,
  used,
  maxGuesses = MAX_GUESSES,
  announcement,
  children,
}: {
  readonly chrome: TermoChrome;
  readonly date: string;
  readonly used: number;
  readonly maxGuesses?: number;
  readonly announcement: string;
  readonly children: ReactNode;
}) {
  const copy = messages.games.termo.play;

  return (
    <main
      className={[screen.page, styles.pageTermo, chrome.pageClassName]
        .filter(Boolean)
        .join(" ")}
      style={ACCENT}
      data-play-state="playing"
    >
      <TermoHeading
        chrome={chrome}
        date={date}
        progress={copy.progressShort(used, maxGuesses)}
      />

      <div className={screen.statsCard}>
        <div aria-hidden className={screen.tape} />
        <div className={screen.statRow}>
          <span className={screen.statLabel}>
            {messages.play.progressLabel}
          </span>
          <span className={screen.progressCard}>
            {copy.progressLong(used, maxGuesses)}
          </span>
        </div>
      </div>

      <section className={screen.board}>
        {children}

        <span className={styles.affordance}>
          <InfoTip text={copy.keyboard.affordance} align="center" />
        </span>

        <p role="status" className={styles.announcer}>
          {announcement}
        </p>
      </section>
    </main>
  );
}

export function TermoNotice({
  notice,
  nonce,
  children,
}: {
  readonly notice: string | null;
  readonly nonce: number;
  readonly children?: ReactNode;
}) {
  return (
    <div className={styles.noticeRow}>
      <p role="status" className={styles.notice}>
        {notice ?? BLANK_READOUT}

        <span className={styles.nonce}>{ZWSP.repeat(nonce % 2)}</span>
      </p>

      {children}
    </div>
  );
}

interface TermoKeys extends Pick<
  TermoPlay,
  "type" | "erase" | "select" | "submit"
> {
  readonly live: boolean;
  readonly cursor: number;
}

export function useTermoKeys(keys: TermoKeys): (key: string) => boolean {
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  });

  const onKey = useCallback((key: string) => {
    const current = keysRef.current;
    return current.live && pressKey(key, current);
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

  return onKey;
}

export function PlayView({
  play,
  chrome = DAILY_CHROME,
}: {
  readonly play: TermoPlay;
  readonly chrome?: TermoChrome;
}) {
  const { state } = play;
  const activeKeyRef = useRef<HTMLButtonElement | null>(null);
  const onKey = useTermoKeys({
    ...play,
    live: state.status === "playing",
    cursor: state.cursor,
  });

  return (
    <TermoPage
      chrome={chrome}
      date={state.date}
      used={play.used}
      announcement={state.announcement}
    >
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

      <TermoNotice notice={state.notice} nonce={state.noticeNonce}>
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
            {messages.games.termo.play.retry}
          </button>
        ) : null}
      </TermoNotice>

      <Keyboard
        state={play.keyboardState}
        onLetter={play.type}
        onEnter={play.submit}
        onErase={play.erase}
        activeKeyRef={activeKeyRef}
      />
    </TermoPage>
  );
}

function pressKey(key: string, keys: TermoKeys): boolean {
  const { cursor } = keys;
  switch (key) {
    case "Enter":
      keys.submit();
      return true;
    case "Backspace":
    case "Delete":
      keys.erase();
      return true;
    case "ArrowLeft":
      keys.select(cursor - 1);
      return true;
    case "ArrowRight":
      keys.select(cursor + 1);
      return true;
    case "Home":
      keys.select(0);
      return true;
    case "End":
      keys.select(WORD_LENGTH - 1);
      return true;
  }
  const letter = typedLetter(key);
  if (letter === null) {
    return false;
  }
  keys.type(letter);
  return true;
}

export function PlaySkeleton({
  date,
  chrome = DAILY_CHROME,
}: {
  readonly date: string;
  readonly chrome?: TermoChrome;
}) {
  return (
    <main
      className={`${screen.page} ${styles.pageTermo}`}
      style={ACCENT}
      data-play-state="skeleton"
    >
      <TermoHeading chrome={chrome} date={date} progress={null} />

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
