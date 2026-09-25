import Link from "next/link";

import type { ArchiveIndexCalendar } from "../../src/archive/calendar";
import { archiveMonthRoute, formatMonth, messages } from "../../src/i18n";
import { PageTopBar } from "../../src/components/page-top-bar";
import styles from "./arquivo.module.css";
import { ArchiveCalendar } from "./calendar-grid";

export function ArchiveIndexView({
  calendar,
  months,
}: {
  readonly calendar: ArchiveIndexCalendar | undefined;
  readonly months: readonly string[];
}) {
  const copy = messages.archive;
  const empty = calendar === undefined && months.length === 0;

  return (
    <main className={styles.page} data-page="arquivo">
      <PageTopBar kicker={copy.title} />

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{copy.title}</h1>

        {empty ? null : <p className={styles.lead}>{copy.lead}</p>}
      </div>

      {empty ? (
        <p className={styles.empty}>{copy.empty}</p>
      ) : (
        <>
          {calendar === undefined ? null : (
            <section className={styles.section}>
              <h2 className={styles.sectionHeading}>
                {formatMonth(`${calendar.month}-01`)}
              </h2>
              <ArchiveCalendar
                month={calendar.month}
                publishedDates={calendar.dates}
              />
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{copy.months.heading}</h2>
            <ul className={styles.months}>
              {months.map((month) => (
                <li key={month}>
                  <Link
                    className={styles.monthChip}
                    href={archiveMonthRoute(month)}
                    prefetch={false}
                  >
                    {formatMonth(`${month}-01`)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
