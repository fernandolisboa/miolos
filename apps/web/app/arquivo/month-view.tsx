import Link from "next/link";

import {
  archiveMonthRoute,
  formatMonth,
  messages,
  routes,
} from "../../src/i18n";
import styles from "./arquivo.module.css";
import { ArchiveCalendar } from "./calendar-grid";

/**
 * One month of the archive (#31, ADR-0053 decision 1; the calendar since
 * #163) — the identical grid anatomy to the index's newest-month section.
 * A cell is ONE date link instead of four game links, which is the point
 * of having a day page at all: a 31-day month is ~31 touch targets rather
 * than 124 anchors, exactly as the day rows it replaced were.
 *
 * `dates` is the month's published days, deduplicated by the page through
 * `archivedDates` from the reader's own `(date, game)` pairs — the reader
 * stays the only authority on which days exist (ADR-0053 decision 3). It
 * arrives as a Set and reaches the grid as the same Set: the membership
 * question the grid asks is what the prop is FOR (step-6 correctness N5).
 *
 * `previous`/`next` are SIBLING navigation and each is absent when there is
 * no such month; the back affordance is the index (`backToIndex`), because
 * every archive surface goes exactly one level up.
 */
export function ArchiveMonthView({
  month,
  dates,
  previous,
  next,
}: {
  readonly month: string;
  readonly dates: ReadonlySet<string>;
  readonly previous: string | undefined;
  readonly next: string | undefined;
}) {
  const copy = messages.archive;

  return (
    <main className={styles.page} data-page="arquivo-mes">
      <header className={styles.topBar}>
        <Link
          className={styles.back}
          href={routes.archive}
          aria-label={copy.backToIndexAria}
        >
          {copy.backToIndex}
        </Link>
        <span className={styles.wordmark}>{messages.brand.wordmark}</span>
        <span className={styles.barKicker}>{copy.title}</span>
      </header>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{formatMonth(`${month}-01`)}</h1>
      </div>

      <section className={styles.section}>
        {/* The month and the year are in the `<h1>` directly above, so the
            grid carries bare day numerals and no duplicate title inside the
            card — the same reasoning that kept them out of the rows
            (step-6 F9). */}
        <ArchiveCalendar month={month} publishedDates={dates} />
      </section>

      {/* Each sibling link is a kicker over a month, never one run of
          uppercase text: `messages.archive.month` records why (impeccable's
          `all-caps-body` gate fires at 30 characters, which the composed
          label passed in four months of every twelve). The composed sentence
          is the accessible name. */}
      <nav className={styles.monthNav}>
        {previous === undefined ? null : (
          <Link
            className={styles.monthNavLink}
            href={archiveMonthRoute(previous)}
            prefetch={false}
            aria-label={copy.month.previousAria(formatMonth(`${previous}-01`))}
          >
            <span className={styles.monthNavKicker}>{copy.month.previous}</span>
            <span className={styles.monthNavMonth}>
              {formatMonth(`${previous}-01`)}
            </span>
          </Link>
        )}
        {next === undefined ? null : (
          <Link
            className={`${styles.monthNavLink} ${styles.monthNavNext}`}
            href={archiveMonthRoute(next)}
            prefetch={false}
            aria-label={copy.month.nextAria(formatMonth(`${next}-01`))}
          >
            <span className={styles.monthNavKicker}>{copy.month.next}</span>
            <span className={styles.monthNavMonth}>
              {formatMonth(`${next}-01`)}
            </span>
          </Link>
        )}
      </nav>
    </main>
  );
}
