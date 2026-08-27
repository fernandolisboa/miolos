import Link from "next/link";

import {
  archiveMonthRoute,
  formatMonth,
  messages,
  routes,
} from "../../src/i18n";
import styles from "./arquivo.module.css";
import { ArchiveCalendar } from "./calendar-grid";

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
        <ArchiveCalendar month={month} publishedDates={dates} />
      </section>

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
