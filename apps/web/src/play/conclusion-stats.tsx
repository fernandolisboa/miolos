"use client";

import { timeBucketIndex, type Game, type StatsResponse } from "@miolos/core";

import { formatElapsed, messages } from "../i18n";
import { useStats } from "../stats/use-stats";
import styles from "./conclusion-view.module.css";
import { BLANK_VALUE } from "./share-button";

export function ConclusionStats({
  game,
  date,
  elapsedMs,
  lost,
}: {
  readonly game: Game;
  readonly date: string;
  readonly elapsedMs: number | undefined;
  readonly lost: boolean;
}) {
  const stats = useStats();
  if (stats === null) {
    return null;
  }
  return (
    <ConclusionStatsBody
      game={game}
      date={date}
      stats={stats}
      elapsedMs={elapsedMs}
      lost={lost}
    />
  );
}

export function ConclusionStatsBody({
  game,
  date,
  stats,
  elapsedMs,
  lost,
}: {
  readonly game: Game;
  readonly date: string;
  readonly stats: StatsResponse | undefined;
  readonly elapsedMs: number | undefined;
  readonly lost: boolean;
}) {
  const loaded = stats !== undefined;
  const dayMatches = loaded && stats.date === date;
  if (game === "termo") {
    const counts = loaded
      ? stats.termo.distribution
      : ([0, 0, 0, 0, 0, 0, 0] as const);
    const max = Math.max(...counts, 1);
    const todayRow = lost
      ? 6
      : loaded && dayMatches && stats.todayTermoGuesses !== null
        ? stats.todayTermoGuesses - 1
        : undefined;
    return (
      <div
        className={styles.statsBlock}
        aria-hidden={loaded ? undefined : true}
        data-stats-state={loaded ? "value" : "skeleton"}
      >
        <div className={styles.distribution}>
          {counts.map((count, index) => {
            const fail = index === 6;
            return (
              <div
                key={fail ? messages.stats.termo.fail : index + 1}
                role="img"
                aria-label={
                  fail
                    ? messages.stats.termo.failAria(count)
                    : messages.stats.termo.rowAria(index + 1, count)
                }
                className={styles.distRow}
                data-today={todayRow === index ? "" : undefined}
              >
                <span
                  aria-hidden
                  className={`${styles.distLabel} tabular-nums`}
                >
                  {fail ? messages.stats.termo.fail : index + 1}
                </span>
                <div aria-hidden className={styles.distTrack}>
                  <div
                    className={styles.distBar}
                    style={{ width: `${String((count / max) * 100)}%` }}
                  />
                </div>
                <span
                  aria-hidden
                  className={`${styles.distCount} tabular-nums`}
                >
                  {loaded ? count : BLANK_VALUE}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const block = loaded ? stats[game] : undefined;
  const counts = block?.histogram ?? ([0, 0, 0, 0, 0, 0] as const);
  const max = Math.max(...counts, 1);

  const todayBucket =
    elapsedMs === undefined || !dayMatches
      ? undefined
      : timeBucketIndex(elapsedMs);
  const name = messages.games[game].name;
  return (
    <div
      className={styles.statsBlock}
      aria-hidden={loaded ? undefined : true}
      data-stats-state={loaded ? "value" : "skeleton"}
    >
      <div className={styles.statRows}>
        <StatRow
          label={messages.stats.rows.best}
          value={
            block === undefined
              ? BLANK_VALUE
              : block.bestMs === null
                ? messages.stats.emptyValue
                : formatElapsed(block.bestMs)
          }
        />
        <StatRow
          label={messages.stats.rows.average}
          value={
            block === undefined
              ? BLANK_VALUE
              : block.averageMs === null
                ? messages.stats.emptyValue
                : formatElapsed(block.averageMs)
          }
        />
        <StatRow
          label={messages.stats.rows.solved(name)}
          value={block === undefined ? BLANK_VALUE : String(block.solved)}
        />
      </div>
      <div className={styles.histogram}>
        {counts.map((count, index) => (
          <div
            key={messages.stats.histogram.labels[index]}
            role="img"
            aria-label={messages.stats.histogram.aria(
              messages.stats.histogram.bucketNames[index] ?? "",
              count,
            )}
            className={styles.bucket}
            data-today={todayBucket === index && count > 0 ? "" : undefined}
          >
            <div aria-hidden className={styles.bucketTrack}>
              <div
                className={styles.bucketBar}
                style={{ height: `${String((count / max) * 100)}%` }}
              />
            </div>
            <span aria-hidden className={`${styles.bucketLabel} tabular-nums`}>
              {messages.stats.histogram.labels[index]}
            </span>
          </div>
        ))}
      </div>

      {loaded &&
        dayMatches &&
        elapsedMs !== undefined &&
        block !== undefined &&
        block.averageSampleCount >= 2 &&
        block.averageMs !== null &&
        elapsedMs !== block.averageMs && (
          <p className={styles.closingLine}>
            {elapsedMs < block.averageMs
              ? messages.conclusion.closingFaster
              : messages.conclusion.closingSlower}
          </p>
        )}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} tabular-nums`}>{value}</span>
    </div>
  );
}
