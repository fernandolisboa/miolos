"use client";

import {
  TERMO_MAX_GUESSES,
  type DayGameState,
  type Game,
  type StatsResponse,
} from "@miolos/core";

import { formatElapsed, messages } from "../i18n";
import { useStats } from "../stats/use-stats";
import { accentVars } from "./accent";
import {
  ConclusionAside,
  ConclusionCardHead,
  ConclusionTopBar,
  nextPendingDaily,
  OutcomeStamp,
  playedOutcome,
  ShippedStamp,
} from "./conclusion-chrome";
import { ConclusionStatsBody } from "./conclusion-stats";
import styles from "./conclusion-view.module.css";
import { useDayState } from "./day-state";
import type { ConclusionCopy } from "./types";

export function RemoteConclusionView({
  game,
  date,
  copy,
  claim,
}: {
  readonly game: Game;
  readonly date: string;
  readonly copy: ConclusionCopy;
  readonly claim: DayGameState;
}) {
  const dayState = useDayState(date);
  const stats = useStats();
  const accent = accentVars(game);
  const played = claim.status === "played";
  const playedStamp = playedOutcome(copy, played);
  const remote = messages.conclusion.remote;

  const next = nextPendingDaily((dayGame) => dayState[dayGame]);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      style={accent}
      data-conclusion-state={played ? "lost" : "result"}
      data-conclusion-remote=""
    >
      <ConclusionTopBar date={date} kicker={copy.kicker} />

      <article className={styles.resultCard}>
        <ConclusionCardHead copy={copy} />
        <div className={styles.stampRow}>
          {game === "termo" ? (
            <RemoteTermoStamp
              title={copy.title}
              played={played}
              guesses={remoteTermoGuesses(stats, date)}
            />
          ) : playedStamp !== undefined ? (
            <OutcomeStamp outcome={playedStamp} />
          ) : (
            <RemoteShippedStamp title={copy.title} claim={claim} />
          )}
        </div>

        <p className={styles.remoteNote}>
          {played ? remote.playedNote : remote.completedNote}
        </p>
        <p role="status" className={styles.remoteBody}>
          {played ? remote.playedBody : remote.completedBody}
        </p>

        {stats !== null && (
          <ConclusionStatsBody
            game={game}
            date={date}
            stats={stats}
            elapsedMs={claim.elapsedMs}
            lost={played}
          />
        )}
      </article>

      <ConclusionAside
        streak
        entryOf={(dayGame) => dayState[dayGame]}
        next={next}
      />
    </main>
  );
}

function remoteTermoGuesses(
  stats: StatsResponse | null | undefined,
  date: string,
): number | undefined {
  return stats !== null &&
    stats !== undefined &&
    stats.date === date &&
    stats.todayTermoGuesses !== null
    ? stats.todayTermoGuesses
    : undefined;
}

function RemoteShippedStamp({
  title,
  claim,
}: {
  readonly title: string;
  readonly claim: DayGameState;
}) {
  if (claim.elapsedMs !== undefined && claim.hintsUsed !== undefined) {
    return (
      <ShippedStamp
        title={title}
        stamp={{ elapsedMs: claim.elapsedMs, hintsUsed: claim.hintsUsed }}
      />
    );
  }
  if (claim.elapsedMs === undefined) {
    return (
      <div
        className={styles.stamp}
        role="img"
        aria-label={messages.conclusion.remote.stampBareAria(title)}
      >
        <span aria-hidden className={styles.stampLabel}>
          {messages.conclusion.stampLabel}
        </span>
      </div>
    );
  }
  const elapsed = formatElapsed(claim.elapsedMs);
  return (
    <div
      className={styles.stamp}
      role="img"
      aria-label={messages.conclusion.remote.stampTimeAria(title, elapsed)}
    >
      <span aria-hidden className={styles.stampLabel}>
        {messages.conclusion.stampLabel}
      </span>
      <span aria-hidden className={styles.stampTime}>
        {elapsed}
      </span>
    </div>
  );
}

function RemoteTermoStamp({
  title,
  played,
  guesses,
}: {
  readonly title: string;
  readonly played: boolean;
  readonly guesses: number | undefined;
}) {
  const copy = messages.games.termo.outcome;
  if (played) {
    return (
      <OutcomeStamp
        outcome={{
          state: "lost",
          label: copy.lostLabel,
          detail: copy.lostDetail(TERMO_MAX_GUESSES),
          aria: copy.lostAria(TERMO_MAX_GUESSES),
        }}
      />
    );
  }
  if (guesses === undefined) {
    return (
      <div
        className={styles.stamp}
        role="img"
        aria-label={messages.conclusion.remote.stampBareAria(title)}
      >
        <span aria-hidden className={styles.stampLabel}>
          {copy.wonLabel}
        </span>
      </div>
    );
  }
  return (
    <OutcomeStamp
      outcome={{
        state: "result",
        label: copy.wonLabel,
        detail: copy.wonDetail(guesses, TERMO_MAX_GUESSES),
        aria: copy.wonAria(guesses, TERMO_MAX_GUESSES),
      }}
    />
  );
}
