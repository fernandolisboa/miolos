"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "../components/brand-mark";
import {
  formatElapsed,
  formatLongDate,
  formatShortDate,
  messages,
  playRoutes,
  routes,
  type Route,
} from "../i18n";
import { useStreak } from "../streak/use-streak";
import { accentVars } from "./accent";
import { BLANK_VALUE } from "./blank-value";
import styles from "./conclusion-view.module.css";
import { DAY_GAMES } from "./day-games";
import type { DayEntry } from "./day-state";
import type {
  ConclusionCopy,
  ConclusionOutcome,
  ConclusionResult,
} from "./types";

export function playedOutcome(
  copy: ConclusionCopy,
  played: boolean,
): ConclusionOutcome | undefined {
  return played ? copy.played : undefined;
}

function StreakCard() {
  const streak = useStreak();
  if (streak === null) {
    return null;
  }
  const loaded = streak !== undefined;
  return (
    <section
      className={styles.streakCard}
      aria-label={
        loaded ? messages.conclusion.streak.aria(streak.streak) : undefined
      }
      aria-hidden={loaded ? undefined : true}
      data-streak-state={loaded ? "value" : "skeleton"}
    >
      <span aria-hidden className={styles.streakCardNumeral}>
        {loaded ? streak.streak : BLANK_VALUE}
      </span>
      <span aria-hidden className={styles.streakCardLabel}>
        {loaded ? messages.conclusion.streak.value(streak.streak) : BLANK_VALUE}
        {loaded && streak.todayCounts && (
          <>
            <br />
            <em className={styles.streakCardTail}>
              {messages.conclusion.streak.maintained}
            </em>
          </>
        )}
      </span>
    </section>
  );
}

export function ShippedStamp({
  title,
  stamp,
}: {
  readonly title: string;
  readonly stamp: ConclusionResult;
}) {
  const elapsed = formatElapsed(stamp.elapsedMs);

  return (
    <div
      className={styles.stamp}
      role="img"
      aria-label={messages.conclusion.stampAria(
        title,
        elapsed,
        stamp.hintsUsed,
      )}
    >
      <span aria-hidden className={styles.stampLabel}>
        {messages.conclusion.stampLabel}
      </span>
      <span aria-hidden className={styles.stampTime}>
        {elapsed}
      </span>
      <span aria-hidden className={styles.stampHints}>
        {messages.conclusion.hints(stamp.hintsUsed)}
      </span>
    </div>
  );
}

export function OutcomeStamp({
  outcome,
}: {
  readonly outcome: ConclusionOutcome;
}) {
  const lost = outcome.state === "lost";
  const chrome = [
    styles.stamp,
    lost ? styles.stampLost : "",
    lost ? styles.stampStill : "",
  ]
    .filter((name) => name !== "")
    .join(" ");

  return (
    <div className={chrome} role="img" aria-label={outcome.aria}>
      <span aria-hidden className={styles.stampLabel}>
        {outcome.label}
      </span>
      <span aria-hidden className={styles.stampGuesses}>
        {outcome.detail}
      </span>
    </div>
  );
}

export function nextPendingDaily(
  entryOf: (game: Game) => DayEntry,
): { readonly game: Game; readonly route: Route } | undefined {
  const game = DAY_GAMES.find(
    (candidate) => entryOf(candidate).status === "pending",
  );
  return game === undefined ? undefined : { game, route: playRoutes[game] };
}

export function ConclusionCardHead({
  copy,
}: {
  readonly copy: ConclusionCopy;
}) {
  return (
    <>
      <div aria-hidden className={styles.tape} />
      <p className={styles.cardKicker}>{copy.kicker}</p>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>{copy.title}</h1>
      </div>
    </>
  );
}

export function ConclusionAside({
  streak,
  entryOf,
  next,
  share,
  prompt,
}: {
  readonly streak: boolean;
  readonly entryOf: (game: Game) => DayEntry;
  readonly next: { readonly game: Game; readonly route: Route } | undefined;
  readonly share?: ReactNode;
  readonly prompt?: ReactNode;
}) {
  return (
    <aside className={styles.side}>
      {streak && <StreakCard />}
      <section className={styles.dayCard}>
        <p className={styles.dayCardTitle}>
          {messages.conclusion.dayCard.title}
        </p>
        <div className={styles.chips}>
          {DAY_GAMES.map((dayGame) => (
            <DayChip key={dayGame} game={dayGame} entry={entryOf(dayGame)} />
          ))}
        </div>
      </section>
      {next === undefined ? (
        <Link className={styles.cta} href={routes.home}>
          {messages.conclusion.ctaHome}
        </Link>
      ) : (
        <Link
          className={`${styles.cta} ${styles.ctaNext}`}
          style={accentVars(next.game)}
          href={next.route}
        >
          {messages.conclusion.ctaNext(messages.games[next.game].name)}
        </Link>
      )}
      {share}

      <Link className={styles.secondaryLink} href={routes.stats}>
        {messages.conclusion.stats}
      </Link>

      {prompt}
    </aside>
  );
}

export function ConclusionTopBar({
  date,
  kicker,
}: {
  readonly date: string;
  readonly kicker: string;
}) {
  return (
    <header className={styles.topBar}>
      <Link
        className={styles.back}
        href={routes.home}
        aria-label={messages.conclusion.backAria}
      >
        {messages.conclusion.back}
      </Link>

      <Wordmark className={styles.wordmark} />
      <span className={styles.barKicker}>{kicker}</span>
      <span className={styles.topDateLong}>{formatLongDate(date)}</span>
      <span className={styles.topDateShort}>{formatShortDate(date)}</span>
    </header>
  );
}

function DayChip({
  game,
  entry,
}: {
  readonly game: (typeof DAY_GAMES)[number];
  readonly entry: DayEntry;
}) {
  const done = entry.status === "completed";
  const value =
    done && entry.elapsedMs !== undefined
      ? formatElapsed(entry.elapsedMs)
      : done
        ? messages.conclusion.dayCard.done
        : entry.status === "played"
          ? messages.conclusion.dayCard.played
          : messages.conclusion.dayCard.missing;
  return (
    <div
      className={`${styles.chip} ${
        done
          ? styles.chipDone
          : entry.status === "played"
            ? styles.chipPlayed
            : styles.chipMissing
      }`}
    >
      {game === "nonogram" ? (
        <>
          <span className={`${styles.chipName} ${styles.chipNameLong}`}>
            {messages.conclusion.dayCard.games.nonogram}
          </span>
          <span className={`${styles.chipName} ${styles.chipNameShort}`}>
            {messages.conclusion.dayCard.games.nonogramShort}
          </span>
        </>
      ) : (
        <span className={styles.chipName}>
          {messages.conclusion.dayCard.games[game]}
        </span>
      )}
      <span className={styles.chipValue}>{value}</span>
    </div>
  );
}
