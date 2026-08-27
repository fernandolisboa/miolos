"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";

import { formatElapsed, messages, playRoutes } from "../src/i18n";
import { completedCount, useDayState } from "../src/play/day-state";
import { useStats } from "../src/stats/use-stats";
import styles from "./page.module.css";

const BLANK_VALUE = " ";

export function HubProgress({
  date,
  total,
}: {
  readonly date: string;
  readonly total: number;
}) {
  const done = completedCount(useDayState(date));
  return (
    <p className={`${styles.metaLine} tabular-nums`}>
      {messages.hoje.completedOfTotal(done, total)}
    </p>
  );
}

export function HubCardAction({
  game,
  date,
}: {
  readonly game: Game;
  readonly date: string;
}) {
  const entry = useDayState(date)[game];
  const route = playRoutes[game];

  //

  const elapsedMs = entry.status === "completed" ? entry.elapsedMs : undefined;

  if (entry.status === "pending") {
    return (
      <Link className={styles.cta} href={route}>
        <PlayLabel />
      </Link>
    );
  }

  if (game === "termo" && entry.status === "completed") {
    return <TermoDoneLink date={date} />;
  }

  const name = messages.games[game].name;
  const elapsed =
    elapsedMs === undefined ? undefined : formatElapsed(elapsedMs);
  return (
    <Link
      className={styles.done}
      href={route}

      aria-label={
        entry.status === "played"
          ? messages.hoje.playedAria(name)
          : elapsed === undefined
            ? messages.hoje.completedAria(name)
            : messages.hoje.doneAria(name, elapsed)
      }
    >
      <span aria-hidden className={styles.doneChip}>
        {entry.status === "played" ? messages.hoje.played : messages.hoje.done}
      </span>

      {elapsed !== undefined && (
        <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
          <span className={styles.doneResultLong}>
            {messages.hoje.doneResultLong(elapsed)}
          </span>
          <span className={styles.doneResultShort}>
            {messages.hoje.doneResultShort(elapsed)}
          </span>
        </span>
      )}
    </Link>
  );
}

function TermoDoneLink({ date }: { readonly date: string }) {
  const stats = useStats();
  const name = messages.games.termo.name;

  const guesses =
    stats !== undefined && stats !== null && stats.date === date
      ? stats.todayTermoGuesses
      : null;
  return (
    <Link
      className={styles.done}
      href={playRoutes.termo}
      aria-label={
        guesses === null
          ? messages.hoje.completedAria(name)
          : messages.hoje.doneGuessesAria(name, guesses)
      }
    >
      <span aria-hidden className={styles.doneChip}>
        {messages.hoje.done}
      </span>
      {guesses !== null ? (
        <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
          <span className={styles.doneResultLong}>
            {messages.hoje.doneResultLong(`${guesses}/6`)}
          </span>
          <span className={styles.doneResultShort}>
            {messages.hoje.doneResultShort(`${guesses}/6`)}
          </span>
        </span>
      ) : (
        stats === undefined && (
          <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
            <span className={styles.doneResultLong}>{BLANK_VALUE}</span>
            <span className={styles.doneResultShort}>{BLANK_VALUE}</span>
          </span>
        )
      )}
    </Link>
  );
}

function PlayLabel() {
  return (
    <>
      <span className={styles.ctaLong}>{messages.hoje.playCta}</span>
      <span className={styles.ctaShort}>{messages.hoje.playCtaShort}</span>
    </>
  );
}
