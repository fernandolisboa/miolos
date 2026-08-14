"use client";

/**
 * The stats screen's one client island (#29, ADR-0051, plan 033 §6.2). It
 * lives beside `page.tsx` for the reason `hub-day-state.tsx` documents:
 * CSS Modules hash class names per file, so the component that paints with
 * `page.module.css` has to import that exact module, and the page itself
 * stays a static server shell.
 *
 * All three hooks fire in mount effects only, so the server markup and the
 * pre-hydration paint agree byte-for-byte (§6.6). Three renderings per
 * surface, each an honest claim:
 *
 * - unsettled — reserved-dimension skeleton, values blanked with the
 *   `BLANK_VALUE` idiom, so the fetch landing shifts nothing (#37). The
 *   medal section is the NAMED exception to this reserved-dimension law:
 *   its height is unknowable pre-fetch and D8's nothing-at-zero rule
 *   makes absence its honest unsettled state, so it reserves nothing and
 *   inserts post-paint (ADR-0052; the measured CLS is its number, not
 *   this screen's).
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
import {
  MEDAL_IDS,
  type CalendarDay,
  type StatsResponse,
  type TermoStats,
  type TimedGame,
  type TimedGameStats,
} from "@miolos/core";

import {
  formatElapsed,
  formatLongDate,
  formatMonth,
  messages,
  todaySaoPauloDate,
} from "../../src/i18n";
import { medalCopy } from "../../src/medals/copy";
import { useMedals } from "../../src/medals/use-medals";
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

export function StatsView() {
  const stats = useStats();

  return (
    <>
      <PerfectDaysCard stats={stats} />
      {/* #30's medal section — between the summary and the per-game
          blocks ("medals display in the stats area", plan 033 D10).
          Medals arrive on their own endpoint and contract (GET /medals,
          ADR-0048 decision 3, ADR-0052), never on /stats. */}
      <MedalsSection />
      <section className={styles.games}>
        {GAME_ORDER.map((game) => (
          <GameBlock key={game} game={game} stats={stats} />
        ))}
      </section>
      <CalendarSection />
    </>
  );
}

/**
 * #30's medal section (ADR-0052) — a compact LIST of earned facts, never a
 * tile grid: the anti-references ban the rounded icon tile and the
 * decorative emoji, which are the two default medal idioms. The section
 * OWNS its hook (the CalendarSection precedent), so the medals settle
 * re-renders exactly this subtree.
 *
 * NOTHING renders at unsettled, at settled-`null` AND at zero earned
 * medals (D8): no heading, no locked-badge grid, no count, no DOM — a
 * locked-medal display is gamification chrome and a padlock grid is the
 * loot-box visual language ADR-0006 exists to keep out. The section
 * appears with the first earned medal. This is also why no dimension is
 * reserved: the height is unknowable pre-fetch (0 to ~23 rows), and the
 * anonymous/zero case inserts nothing, so the CI-visible state is
 * CLS-neutral by construction (#37 inherits the measured seeded number).
 *
 * Unknown ids are silently DROPPED (the drop-unknown rule, ADR-0052's
 * honesty mechanism): membership in the bundled catalog is the filter — a
 * `Set` over the payload makes it O(1), and walking `MEDAL_IDS` makes
 * catalog order the display order (no date exists on the wire to sort by).
 * An all-unknown payload is the zero state too.
 *
 * The stamp-ring is ONE uniform hue for every medal — `--accent-app` on a
 * SHAPE, never a word (ADR-0041): the list is an account-level surface,
 * every row is the same state (earned), so no meaning rides on hue, and
 * the words beside it stay `--ink`/`--ink-2`.
 */
function MedalsSection() {
  const medals = useMedals();
  if (medals === undefined || medals === null) {
    return null;
  }
  const earned = new Set<string>(medals.medals);
  const known = MEDAL_IDS.filter((id) => earned.has(id));
  if (known.length === 0) {
    return null;
  }
  return (
    <section className={styles.medals}>
      <h2 className={styles.sectionHeading}>{messages.medals.title}</h2>
      {/* role="list" is load-bearing, not redundant: `list-style: none`
          strips WebKit's list semantics (Safari/VoiceOver), and the
          explicit role is the standard workaround. */}
      <ul role="list" className={styles.medalList}>
        {known.map((id) => (
          // The visible name/description ARE the accessible content —
          // no aria-label, no aria-hidden on the words: a composed label
          // on the <li> is name-PROHIBITED on WebKit once the list
          // semantics are stripped, and hiding the text left VoiceOver
          // announcing nothing (step-6 correctness finding).
          <li key={id} className={styles.medalRow}>
            <span aria-hidden className={styles.medalRing} />
            <span className={styles.medalWords}>
              <span className={styles.medalName}>{medalCopy[id].name}</span>
              <span className={styles.medalDescription}>
                {medalCopy[id].description}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
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
 *
 * The section OWNS its hook (step-6 F6): the calendar enumeration is this
 * subtree's only consumer, so the `/stats` settle never touches the
 * ~1,300-cell tree — each fetch re-renders exactly the surface it feeds.
 */
function CalendarSection() {
  const calendar = useStatsCalendar();
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
  // The settled-null neutral month is the app's SINGLE legal device-clock
  // read (ADR-0051's consequence; the shared helper's own doc states the
  // boundary): presentation only — the month title claims no state for any
  // day, selects no record and backs no derived value. This branch cannot
  // exist before mount, so the server markup never carries its output and
  // the pre-hydration byte-agreement holds by construction. Data-bearing
  // months come exclusively from the server enumeration.
  const months =
    calendar === null
      ? [neutralMonth(todaySaoPauloDate(new Date()))]
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
