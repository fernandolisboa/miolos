"use client";

/**
 * The stats screen's one client island (#29, ADR-0051, plan 033 §6.2). It
 * lives beside `page.tsx` for the reason `hub-day-state.tsx` documents:
 * CSS Modules hash class names per file, so the component that paints with
 * `page.module.css` has to import that exact module, and the page itself
 * stays a static server shell.
 *
 * Both hooks fire in mount effects only, so the server markup and the
 * pre-hydration paint agree byte-for-byte (§6.6). Three renderings per
 * surface, each an honest claim:
 *
 * - unsettled — reserved-dimension skeleton, values blanked with the
 *   `BLANK_VALUE` idiom, so the fetch landing shifts nothing (#37).
 * - settled-`null` (cold visitor — the profile `impeccable detect` always
 *   scans, since /stats is `requireUserId`-gated and the preview's
 *   credentialed calls are anonymous) — REAL zeros, the way the hub
 *   renders streak 0, and the calendar's neutral current month with no
 *   legend claims: a cold profile has no history to assert.
 * - the server's answer.
 *
 * Every word on paper is `--ink`/`--ink-2`; the accents colour bars, tape,
 * shadows and calendar cells — shapes, never words (ADR-0041). Numerals
 * that must align ride Instrument Sans + `tabular-nums` (ADR-0036).
 */
import type {
  CalendarDay,
  StatsCalendarResponse,
  StatsResponse,
  TermoStats,
  TimedGameStats,
} from "@miolos/core";

import {
  formatElapsed,
  formatLongDate,
  formatMonth,
  locale,
  messages,
} from "../../src/i18n";
import { accentVars } from "../../src/play/accent";
import {
  calendarMonths,
  neutralMonth,
  type CalendarMonth,
} from "../../src/stats/calendar-month";
import { useStats } from "../../src/stats/use-stats";
import { useStatsCalendar } from "../../src/stats/use-stats-calendar";
import styles from "./page.module.css";

/** A non-breaking space: holds a line box open with nothing in it — the
 *  `PlaySkeleton` blank-values idiom (conclusion-view.tsx). */
const BLANK_VALUE = " ";

/** The hub's day order, which is the order a player already knows. */
const GAME_ORDER = ["termo", "sudoku", "nonogram", "binairo"] as const;

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

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

/**
 * Today's SP calendar day from the CLIENT clock — presentation only, and
 * the one legal reading of it on this screen: the settled-`null` calendar
 * draws the current month's GEOMETRY with every cell neutral, claiming no
 * state for any day, selecting no record and backing no derived value
 * (ADR-0031; the client clock is never a source of truth). It is only
 * ever called from the settled-`null` branch, which cannot exist before
 * mount, so the server markup never carries its output and the
 * pre-hydration byte-agreement holds by construction. The data-bearing
 * months come exclusively from the server enumeration.
 */
function todaySaoPauloDate(): string {
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(new Date());
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

export function StatsView() {
  const stats = useStats();
  const calendar = useStatsCalendar();

  return (
    <>
      <PerfectDaysCard stats={stats} />
      {/* #30's medal section slots HERE — between the summary and the
          per-game blocks ("medals display in the stats area", plan 033
          D10). Nothing empty is rendered until then: a placeholder
          section would be fake UI. Medals arrive on their own endpoint
          and contract (ADR-0048 decision 3), never on /stats. */}
      <section className={styles.games}>
        {GAME_ORDER.map((game) => (
          <GameBlock key={game} game={game} stats={stats} />
        ))}
      </section>
      <CalendarSection calendar={calendar} />
    </>
  );
}

/** The summary row: `Dias Perfeitos — N` (plan 033 D10's screen order). */
function PerfectDaysCard({
  stats,
}: {
  readonly stats: StatsResponse | null | undefined;
}) {
  const loaded = stats !== undefined;
  const count = stats === undefined || stats === null ? 0 : stats.perfectDays;
  return (
    <section
      className={styles.summary}
      aria-label={loaded ? messages.stats.perfectDays.aria(count) : undefined}
      aria-hidden={loaded ? undefined : true}
      data-stats-state={loaded ? "value" : "skeleton"}
    >
      <span aria-hidden className={`${styles.summaryNumeral} tabular-nums`}>
        {loaded ? count : BLANK_VALUE}
      </span>
      <span aria-hidden className={styles.summaryLabel}>
        {messages.stats.perfectDays.label}
      </span>
    </section>
  );
}

/** One game's card: the hub-card chrome, this game's accent on its shapes. */
function GameBlock({
  game,
  stats,
}: {
  readonly game: (typeof GAME_ORDER)[number];
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

/** F5's stat-row register plus the 6-bucket histogram, for one timed game. */
function TimedBlock({
  game,
  stats,
}: {
  readonly game: Exclude<(typeof GAME_ORDER)[number], "termo">;
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

/**
 * DESIGN.md's Histogram: bars in the game's accent, 3px top radius, labels
 * `--ink` — the bar carries the accent, never the label (ADR-0041
 * decision 1). No "today" exists on the all-time screen, so every bar is
 * the solid form; the conclusion's copy of this component is the one that
 * highlights a bucket.
 */
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

/**
 * Termo's block: the solved row plus the 7-row guess distribution — rows
 * `1`–`6` and the fail row `X`, horizontal bars in Termo's accent, counts
 * `tabular-nums` in `--ink`. No time row exists anywhere for this game
 * (ADR-0045 decision 4, plan 033 D8).
 */
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

/**
 * The calendar: month grids newest-first, back to the month of
 * `days[0].date` (the server's range start — the account's own first SP
 * day, plan 033 D2/D6). The three day states are geometry first, colour
 * second (§6.2's binding carriers): filled / outlined / plain survive
 * greyscale by construction, and the app accent — never a game's — is the
 * hue, because the calendar is app identity.
 */
function CalendarSection({
  calendar,
}: {
  readonly calendar: StatsCalendarResponse | null | undefined;
}) {
  if (calendar === undefined) {
    // Reserved dimensions, no month claimed: the server markup renders
    // this same box, so the pre-hydration paint agrees byte-for-byte.
    return (
      <section className={styles.calendar} data-stats-state="skeleton">
        <h2 className={styles.sectionHeading}>
          {messages.stats.calendar.title}
        </h2>
        <div aria-hidden className={styles.calendarSkeleton} />
      </section>
    );
  }
  const months =
    calendar === null
      ? [neutralMonth(todaySaoPauloDate())]
      : calendarMonths(calendar.days);
  return (
    <section className={styles.calendar} data-stats-state="value">
      <h2 className={styles.sectionHeading}>{messages.stats.calendar.title}</h2>
      {/* No legend on the cold profile: a legend over an all-neutral month
          would claim states no cell carries (§6.2's "no legend claims"). */}
      {calendar !== null && (
        <div className={styles.legend}>
          {(["onTime", "late", "missed"] as const).map((state) => (
            <span key={state} className={styles.legendItem}>
              <span
                aria-hidden
                className={styles.legendSwatch}
                data-state={state}
              />
              {messages.stats.calendar.legend[state]}
            </span>
          ))}
        </div>
      )}
      {months.map((month) => (
        <MonthGrid key={month.month} month={month} />
      ))}
    </section>
  );
}

function MonthGrid({ month }: { readonly month: CalendarMonth }) {
  return (
    <div className={styles.month}>
      <h3 className={styles.monthTitle}>{formatMonth(month.month)}</h3>
      <div className={styles.monthGrid}>
        {month.cells.map((cell, index) =>
          cell === null ? (
            // Leading/trailing weekday padding and days outside the
            // enumerated range: empty paper, never a fabricated "missed".
            // The index key is right here: a pad cell has no identity
            // beyond its grid position, and the grid never reorders.
            <span key={index} aria-hidden className={styles.dayPad} />
          ) : (
            <DayCell key={cell.date} day={cell} />
          ),
        )}
      </div>
    </div>
  );
}

function DayCell({ day }: { readonly day: CalendarDay }) {
  const date = formatLongDate(day.date);
  const aria =
    day.state === "onTime"
      ? day.perfect
        ? messages.stats.calendar.dayAria.onTimePerfect(date)
        : messages.stats.calendar.dayAria.onTime(date)
      : day.state === "late"
        ? messages.stats.calendar.dayAria.late(date)
        : messages.stats.calendar.dayAria.missed(date);
  return (
    <span
      role="img"
      aria-label={aria}
      className={styles.day}
      data-state={day.state}
      data-perfect={day.perfect ? "" : undefined}
    >
      <span aria-hidden className={`${styles.dayNumeral} tabular-nums`}>
        {Number(day.date.slice(8))}
      </span>
      {day.perfect && (
        // The Dia Perfeito marker: a SHAPE — a small diamond — never a
        // word (ADR-0041). Paper on the filled cell, at the same measured
        // 6.2980:1 the fill itself clears (see page.module.css).
        <span aria-hidden className={styles.perfectMark} />
      )}
    </span>
  );
}
