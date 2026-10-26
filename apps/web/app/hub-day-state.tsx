"use client";

import { dayMarkOf, type Game } from "@miolos/core";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatElapsed, messages, playRoutes } from "../src/i18n";
import { BLANK_VALUE } from "../src/play/blank-value";
import {
  completedGames,
  useDayState,
  type DayEntry,
} from "../src/play/day-state";
import { DAY_GAMES } from "../src/play/day-games";
import { useStats } from "../src/stats/use-stats";
import { useTucked } from "../src/hub/use-tucked";
import styles from "./page.module.css";

const LINEUP: ReadonlySet<Game> = new Set(DAY_GAMES);

export function HubProgress({ date }: { readonly date: string }) {
  const won = completedGames(useDayState(date));
  const mark = dayMarkOf(won, LINEUP);
  return (
    <p className={`${styles.metaLine} tabular-nums`}>
      {messages.hoje.completedOfTotal(won.size, DAY_GAMES.length)}
      {mark !== undefined && (
        <span className={styles.dayMark} data-mark={mark}>
          {messages.dayMark[mark]}
        </span>
      )}
    </p>
  );
}

export interface DoneView {
  readonly chip: string;
  readonly result: string | undefined;
  readonly label: string;
}

export function DoneSummary({
  game,
  date,
  entry,
  children,
}: {
  readonly game: Game;
  readonly date: string;
  readonly entry: DayEntry;
  readonly children: (view: DoneView) => ReactNode;
}) {
  if (game === "termo" && entry.status === "completed") {
    return <TermoSummary date={date}>{children}</TermoSummary>;
  }
  const name = messages.games[game].name;
  if (entry.status === "played") {
    return children({
      chip: messages.hoje.played,
      result: undefined,
      label: messages.hoje.playedAria(name),
    });
  }
  const elapsed =
    entry.elapsedMs === undefined ? undefined : formatElapsed(entry.elapsedMs);
  return children({
    chip: messages.hoje.done,
    result: elapsed,
    label:
      elapsed === undefined
        ? messages.hoje.completedAria(name)
        : messages.hoje.doneAria(name, elapsed),
  });
}

function TermoSummary({
  date,
  children,
}: {
  readonly date: string;
  readonly children: (view: DoneView) => ReactNode;
}) {
  const stats = useStats();
  const name = messages.games.termo.name;
  const guesses =
    stats !== undefined && stats !== null && stats.date === date
      ? stats.todayTermoGuesses
      : null;
  return children({
    chip: messages.hoje.done,
    result:
      guesses !== null
        ? `${String(guesses)}/6`
        : stats === undefined
          ? BLANK_VALUE
          : undefined,
    label:
      guesses === null
        ? messages.hoje.completedAria(name)
        : messages.hoje.doneGuessesAria(name, guesses),
  });
}

export function HubCardAction({
  game,
  date,
}: {
  readonly game: Game;
  readonly date: string;
}) {
  const entry = useDayState(date)[game];
  const tucked = useTucked(game);
  const route = playRoutes[game];

  if (entry.status === "pending" || tucked) {
    return (
      <Link className={styles.cta} href={route}>
        <PlayLabel />
      </Link>
    );
  }

  return (
    <DoneSummary game={game} date={date} entry={entry}>
      {(view) => (
        <Link className={styles.done} href={route} aria-label={view.label}>
          <span aria-hidden className={styles.doneChip}>
            {view.chip}
          </span>
          {view.result !== undefined && (
            <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
              {view.result}
            </span>
          )}
        </Link>
      )}
    </DoneSummary>
  );
}

export function DoneRow({
  game,
  date,
}: {
  readonly game: Game;
  readonly date: string;
}) {
  const entry = useDayState(date)[game];
  const tucked = useTucked(game);
  if (!tucked || entry.status === "pending") {
    return <DoneRowLink game={game} view={undefined} />;
  }
  return (
    <DoneSummary game={game} date={date} entry={entry}>
      {(view) => <DoneRowLink game={game} view={view} />}
    </DoneSummary>
  );
}

function DoneRowLink({
  game,
  view,
}: {
  readonly game: Game;
  readonly view: DoneView | undefined;
}) {
  return (
    <Link
      className={styles.doneRow}
      href={playRoutes[game]}
      aria-label={view?.label ?? messages.games[game].name}
    >
      <span aria-hidden className={styles.doneSwatch} />
      <span aria-hidden className={styles.doneName}>
        {messages.games[game].name}
      </span>
      <span aria-hidden className={`${styles.doneResult} tabular-nums`}>
        {view?.result}
      </span>
      {view !== undefined && (
        <span aria-hidden className={styles.doneChip}>
          {view.chip}
        </span>
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
