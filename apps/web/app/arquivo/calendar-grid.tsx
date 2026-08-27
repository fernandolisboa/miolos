import Link from "next/link";

import { archiveCalendarMonth } from "../../src/archive/calendar";
import { WEEK_LENGTH } from "../../src/calendar/month-grid";
import {
  archiveDayRoute,
  formatDayNumber,
  formatLongDate,
  messages,
} from "../../src/i18n";
import styles from "./arquivo.module.css";

export function ArchiveCalendar({
  month,
  publishedDates,
}: {
  readonly month: string;
  readonly publishedDates: ReadonlySet<string>;
}) {
  const copy = messages.archive.calendar;
  const { cells } = archiveCalendarMonth(month, publishedDates);

  return (
    <div className={styles.calendarCard}>
      <div aria-hidden className={styles.weekdays}>
        {copy.weekdays.map((weekday) => (
          <span key={weekday} className={styles.weekday}>
            {weekday}
          </span>
        ))}
      </div>
      <ul role="list" className={styles.calendarGrid}>
        {cells.map((cell, index) => {
          if (cell === null) {
            return (
              <li
                key={`pad-${String(index)}`}
                aria-hidden
                className={styles.dayCellPad}
              />
            );
          }
          if (!cell.linked) {
            return (
              <li key={cell.date} aria-hidden className={styles.dayCellInert}>
                <span className={styles.dayNumeral}>
                  {formatDayNumber(cell.date)}
                </span>
              </li>
            );
          }

          const weekday = copy.weekdaysLong[index % WEEK_LENGTH] ?? "";
          return (
            <li key={cell.date}>
              <Link
                className={styles.dayCellLink}
                href={archiveDayRoute(cell.date)}
                prefetch={false}
                aria-label={copy.dayAria(formatLongDate(cell.date), weekday)}
              >
                <span className={styles.dayNumeral}>
                  {formatDayNumber(cell.date)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
