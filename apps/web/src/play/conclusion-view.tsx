"use client";

import {
  TERMO_MAX_GUESSES,
  timeBucketIndex,
  type DayGameState,
  type Game,
  type StatsResponse,
} from "@miolos/core";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import {
  formatElapsed,
  formatLongDate,
  formatShortDate,
  messages,
  playRoutes,
  routes,
  type Route,
} from "../i18n";
import { useStats } from "../stats/use-stats";
import { useStreak } from "../streak/use-streak";
import { accentVars } from "./accent";
import styles from "./conclusion-view.module.css";

import {
  refreshServerDay,
  useDayState,
  useServerDayClaim,
  type DayEntry,
} from "./day-state";
import { picturePath } from "./picture-path";
import { BLANK_VALUE, ShareButton } from "./share-button";
import { startCompletionSync } from "./sync";
import type {
  ConclusionAnswer,
  ConclusionCopy,
  ConclusionOutcome,
  ConclusionPicture,
} from "./types";
import { useRecordSnapshot } from "./use-record-snapshot";
/**
 * The conclusion tree is lazy on the PLAY routes, so this inner boundary
 * exists for the `/<jogo>/concluido` pages, which import this file
 * STATICALLY for their server render: without it the whole push stack would
 * join their first-load sets for a card most visitors never see. The card
 * renders `null` server-side anyway, so `ssr: false` changes no paint.
 */
const PushPromptCard = nextDynamic(
  () => import("./push-prompt-card").then((mod) => mod.PushPromptCard),
  { ssr: false },
);

/** The four dailies, in the order Hoje lists them. */
const DAY_GAMES = ["termo", "sudoku", "nonogram", "binairo"] as const;

/**
 * What the stamp shows when the conclusion renders in place, straight from
 * the live play state. It exists because the swap happens in the same commit
 * that closes the grid, and React runs a child's mount effect BEFORE its
 * parent's — so the record this view would otherwise read has not been
 * written yet. Passing the values down also keeps the in-place conclusion
 * working where `localStorage` throws (Safari private mode).
 */
export interface ConclusionResult {
  readonly elapsedMs: number;
  readonly hintsUsed: number;
}

export function ConclusionView({
  game,
  date,
  copy,
  result,
  picture,
  outcome,
  answer,
}: {
  readonly game: Game;
  readonly date: string;
  readonly copy: ConclusionCopy;
  readonly result?: ConclusionResult;
  readonly picture?: ConclusionPicture;
  readonly outcome?: ConclusionOutcome;
  readonly answer?: ConclusionAnswer;
}) {
  const snapshot = useRecordSnapshot(game, date);
  const hydrated = snapshot.hydrated;
  const record = snapshot.hydrated ? snapshot.record : undefined;
  const dayState = useDayState(date);
  const claim = useServerDayClaim(date, game);

  useEffect(() => {
    return startCompletionSync();
  }, [date]);

  const accent = accentVars(game);

  const stored = record?.concluded === true ? record : undefined;
  // The record wins when it has one: on `recorded: false` the flush writes
  // the server's authoritative values back into it, and the conclusion must
  // never show a time the server does not hold.
  const stamp: ConclusionResult | undefined = stored ?? result;
  const syncOutcome = stored?.syncOutcome;

  useEffect(() => {
    if (syncOutcome === "recorded") {
      refreshServerDay();
    }
  }, [syncOutcome]);

  if (!hydrated) {
    return (
      <main
        className={`${styles.page} ${styles.pageEmpty}`}
        style={accent}
        data-conclusion-state="skeleton"
      >
        <ConclusionTopBar date={date} kicker={copy.kicker} />
        <div className={styles.emptyBody}>
          <div aria-hidden className={styles.skeletonCard} />
        </div>
      </main>
    );
  }

  // The branch order is load-bearing — see ADR-0043.
  const lost = outcome?.state === "lost";

  if (!lost && stamp === undefined) {
    if (claim !== undefined) {
      return (
        <RemoteConclusionView
          game={game}
          date={date}
          copy={copy}
          claim={claim}
        />
      );
    }
    return (
      <main
        className={`${styles.page} ${styles.pageEmpty}`}
        style={accent}
        data-conclusion-state="empty"
      >
        <ConclusionTopBar date={date} kicker={copy.kicker} />
        <div className={styles.emptyBody}>
          <article className={styles.emptyCard}>
            <div aria-hidden className={styles.tape} />
            {/* h1 first element child of its wrapper — two impeccable
                rules anchor on `h1.previousElementSibling` here. */}
            <div className={styles.titleRow}>
              <h1 className={styles.emptyTitle}>{copy.notYet.title}</h1>
            </div>
            <p className={styles.emptyBodyText}>
              {messages.conclusion.notYet.body}
            </p>
            <Link className={styles.emptyCta} href={playRoutes[game]}>
              {copy.notYet.cta}
            </Link>
          </article>
        </div>
      </main>
    );
  }

  const dayEntry = (dayGame: Game): DayEntry =>
    dayGame === game
      ? outcome === undefined
        ? // `stamp` is defined on every path that reaches here with no
          // `outcome` — the guard above returned otherwise — and the
          // optional chain is TypeScript's acknowledgement of that rather
          // than a second possibility.
          { status: "completed", elapsedMs: stamp?.elapsedMs }
        : outcome.state === "lost"
          ? { status: "played", elapsedMs: undefined }
          : { status: "completed", elapsedMs: undefined }
      : dayState[dayGame];
  const next = nextPendingDaily(dayEntry);

  return (
    <main
      className={`${styles.page} ${styles.pageResult}`}
      style={accent}
      data-conclusion-state={lost ? "lost" : "result"}
    >
      <ConclusionTopBar date={date} kicker={copy.kicker} />

      <article className={styles.resultCard}>
        <ConclusionCardHead copy={copy} />
        <div className={styles.stampRow}>
          {outcome === undefined ? (
            // The `null` arm is unreachable: the guard above returns `empty`
            // when there is no outcome and no stamp.
            stamp === undefined ? null : (
              <ShippedStamp title={copy.title} stamp={stamp} />
            )
          ) : (
            <OutcomeStamp outcome={outcome} />
          )}
        </div>
        {outcome !== undefined && (
          <p role="status" className={styles.announcer}>
            {outcome.aria}
          </p>
        )}
        {answer !== undefined && (
          <div className={styles.dayWordRow}>
            <p className={styles.dayWordResult}>{answer.result}</p>
            <p className={styles.dayWordLead}>{answer.lead}</p>
            <p className={styles.dayWord}>{answer.canonical}</p>
          </div>
        )}
        {picture !== undefined && (
          <div className={styles.pictureRow}>
            <svg
              className={styles.picture}
              role="img"
              aria-label={picture.label}
              viewBox={`0 0 ${String(picture.size)} ${String(picture.size)}`}
              shapeRendering="crispEdges"
            >
              <path d={picturePath(picture)} />
            </svg>
            {picture.name !== undefined && (
              <div className={styles.pictureCaption}>
                {picture.lead !== undefined && (
                  <p className={styles.pictureLead}>{picture.lead}</p>
                )}
                <p className={styles.pictureName}>{picture.name}</p>
              </div>
            )}
          </div>
        )}
        {/* `recorded` guarantees the just-finished game's ROW is on the
            server; it does NOT guarantee the server still holds the
            record's day AS today. */}
        {syncOutcome === "recorded" && (
          <ConclusionStats game={game} date={date} result={stamp} lost={lost} />
        )}
        {syncOutcome === "pending" && (
          <p className={styles.sync}>{messages.conclusion.sync.pending}</p>
        )}
        {syncOutcome === "rejected" && (
          <p className={styles.sync}>{messages.conclusion.sync.rejected}</p>
        )}
      </article>

      <ConclusionAside
        streak={syncOutcome === "recorded"}
        entryOf={dayEntry}
        next={next}
        share={
          <ShareButton game={game} date={date} stored={stored} stamp={stamp} />
        }
        prompt={<PushPromptCard />}
      />
    </main>
  );
}

/**
 * The cross-device completed view (ADR-0065): the day was decided on ANOTHER
 * device — `claim` is the server's own claim for this game — and this device
 * holds no record, so the play route renders the conclusion the server can
 * honestly back instead of a fresh playable board.
 *
 * THE `game === "termo"` BRANCH BELOW CROSSES ADR-0029 DECISION 2. The
 * crossing is forced, not chosen: `ConclusionCopy` is plain data across the
 * RSC boundary, so `wonDetail(guesses, max)` cannot arrive pre-composed, and
 * this stamp's detail exists only after a CLIENT fetch (`GET /stats`)
 * resolves. This is the ONLY per-game JSX branch permitted in this module;
 * a fifth game adds a claim field, never an arm.
 */
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
          ) : (
            <RemoteShippedStamp title={copy.title} claim={claim} />
          )}
        </div>
        {/* see ADR-0043 */}
        <p role="status" className={styles.announcer}>
          {played ? remote.playedBody : remote.completedBody}
        </p>
        <p className={styles.remoteNote}>
          {played ? remote.playedNote : remote.completedNote}
        </p>
        <p className={styles.remoteBody}>
          {played ? remote.playedBody : remote.completedBody}
        </p>
        {/* `null` — the fetch settled without a value — unmounts to the
            shipped absence, exactly like the local path. */}
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

function ConclusionStats({
  game,
  date,
  result,
  lost,
}: {
  readonly game: Game;
  readonly date: string;
  readonly result: ConclusionResult | undefined;
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
      elapsedMs={result?.elapsedMs}
      lost={lost}
    />
  );
}

function ConclusionStatsBody({
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
  // The render marks only a bucket whose own count is nonzero: the
  // highlight claims "your solve is in this bar", and an empty bar holds
  // nothing to claim.
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
      {/* The comparison is against the INCLUSIVE average, which is honest
          because its direction always agrees with the exclusive one —
          x < mean(S ∪ {x}) ⇔ x < mean(S) for nonempty S. Equal renders
          neither line. */}
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

function ShippedStamp({
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

function OutcomeStamp({ outcome }: { readonly outcome: ConclusionOutcome }) {
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

function nextPendingDaily(
  entryOf: (game: Game) => DayEntry,
): { readonly game: Game; readonly route: Route } | undefined {
  const game = DAY_GAMES.find(
    (candidate) => entryOf(candidate).status === "pending",
  );
  return game === undefined ? undefined : { game, route: playRoutes[game] };
}

function ConclusionCardHead({ copy }: { readonly copy: ConclusionCopy }) {
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

function ConclusionAside({
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
      {/* /estatisticas is a real route, so the link carries it. */}
      <Link className={styles.secondaryLink} href={routes.stats}>
        {messages.conclusion.stats}
      </Link>
      {/* The prompt slot renders LAST: the push card mounts hundreds of ms
          after paint and nothing sits below it, so the insertion shifts no
          content and costs zero CLS. */}
      {prompt}
    </aside>
  );
}

function ConclusionTopBar({
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
      {/* Two nodes per viewport, one hidden by a media query: F5 centres the
          italic wordmark and puts the kicker inside the card, F6 centres the
          kicker in the bar and its card has none. */}
      <span className={styles.wordmark}>{messages.brand.wordmark}</span>
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
  // The guard is split because a WON Termo is a completed entry with no
  // duration — see ADR-0045.
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
          {/* A distinct mobile string, never a runtime truncation. */}
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
