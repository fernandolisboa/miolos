"use client";

import {
  type StatsResponse,
  type TermoStats,
  type TimedGame,
  type TimedGameStats,
} from "@miolos/core";

import { formatElapsed, messages } from "../../src/i18n";
import { MedalsSection } from "../../src/medals/medals-section";
import { accentVars } from "../../src/play/accent";
import { DAY_GAMES } from "../../src/play/day-games";
import { useFullDays } from "../../src/stats/use-full-days";
import { useStats } from "../../src/stats/use-stats";
import styles from "./page.module.css";
import { StatsCalendar } from "./stats-calendar";

const BLANK_VALUE = " ";

const TIMED_ZERO: TimedGameStats = {
  solved: 0,
  bestMs: null,
  averageMs: null,
  averageSampleCount: 0,
  histogram: [0, 0, 0, 0, 0, 0],
};

const TERMO_ZERO: TermoStats = {
  solved: 0,
  distribution: [0, 0, 0, 0, 0, 0, 0],
};

export function StatsView() {
  const stats = useStats();
  const fullDays = useFullDays();

  return (
    <>
      <div className={styles.summaries}>
        {fullDays !== null && (
          <SummaryCount
            copy={messages.stats.fullDays}
            count={fullDays?.dates.length}
          />
        )}
        <SummaryCount
          copy={messages.stats.perfectDays}
          count={stats === undefined ? undefined : (stats?.perfectDays ?? 0)}
        />
      </div>

      <MedalsSection />
      <section className={styles.games}>
        {DAY_GAMES.map((game) => (
          <GameBlock key={game} game={game} stats={stats} />
        ))}
      </section>
      <StatsCalendar fullDays={fullDays} />
    </>
  );
}

function SummaryCount({
  copy,
  count,
}: {
  readonly copy: {
    readonly label: string;
    readonly aria: (n: number) => string;
  };
  readonly count: number | undefined;
}) {
  const loaded = count !== undefined;
  return (
    <section
      className={styles.summary}
      aria-label={loaded ? copy.aria(count) : undefined}
      aria-hidden={loaded ? undefined : true}
      data-stats-state={loaded ? "value" : "skeleton"}
    >
      <span aria-hidden className={`${styles.summaryNumeral} tabular-nums`}>
        {loaded ? count : BLANK_VALUE}
      </span>
      <span aria-hidden className={styles.summaryLabel}>
        {copy.label}
      </span>
    </section>
  );
}

function GameBlock({
  game,
  stats,
}: {
  readonly game: (typeof DAY_GAMES)[number];
  readonly stats: StatsResponse | null | undefined;
}) {
  return (
    <article className={styles.gameCard} style={accentVars(game)}>
      <div aria-hidden className={styles.tape} />
      <p className={styles.cardKicker}>{messages.games[game].kicker}</p>
      <h2 className={styles.cardTitle}>{messages.games[game].name}</h2>
      {game === "termo" ? (
        <TermoBlock stats={stats} />
      ) : (
        <TimedBlock game={game} stats={stats} />
      )}
    </article>
  );
}

function TimedBlock({
  game,
  stats,
}: {
  readonly game: TimedGame;
  readonly stats: StatsResponse | null | undefined;
}) {
  const block =
    stats === undefined ? undefined : stats === null ? TIMED_ZERO : stats[game];
  const name = messages.games[game].name;
  return (
    <div data-stats-state={block === undefined ? "skeleton" : "value"}>
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
      <Histogram histogram={block?.histogram} />
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

function Histogram({
  histogram,
}: {
  readonly histogram: TimedGameStats["histogram"] | undefined;
}) {
  const counts = histogram ?? TIMED_ZERO.histogram;
  const max = Math.max(...counts, 1);
  return (
    <div
      className={styles.histogram}
      aria-hidden={histogram === undefined ? true : undefined}
    >
      {counts.map((count, index) => (
        <div
          key={messages.stats.histogram.labels[index]}
          role="img"
          aria-label={messages.stats.histogram.aria(
            messages.stats.histogram.bucketNames[index] ?? "",
            count,
          )}
          className={styles.bucket}
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
  );
}

function TermoBlock({
  stats,
}: {
  readonly stats: StatsResponse | null | undefined;
}) {
  const block =
    stats === undefined ? undefined : stats === null ? TERMO_ZERO : stats.termo;
  const counts = block?.distribution ?? TERMO_ZERO.distribution;
  const max = Math.max(...counts, 1);
  return (
    <div data-stats-state={block === undefined ? "skeleton" : "value"}>
      <div className={styles.statRows}>
        <StatRow
          label={messages.stats.rows.solved(messages.games.termo.name)}
          value={block === undefined ? BLANK_VALUE : String(block.solved)}
        />
      </div>
      <div
        className={styles.distribution}
        aria-hidden={block === undefined ? true : undefined}
      >
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
            >
              <span aria-hidden className={`${styles.distLabel} tabular-nums`}>
                {fail ? messages.stats.termo.fail : index + 1}
              </span>
              <div aria-hidden className={styles.distTrack}>
                <div
                  className={styles.distBar}
                  style={{ width: `${String((count / max) * 100)}%` }}
                />
              </div>
              <span aria-hidden className={`${styles.distCount} tabular-nums`}>
                {block === undefined ? BLANK_VALUE : count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
