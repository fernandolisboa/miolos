import Link from "next/link";

import {
  adjacentMonths,
  archiveCalendarMonth,
} from "../../src/archive/calendar";
import { WEEK_LENGTH } from "../../src/calendar/month-grid";
import {
  archiveDayRoute,
  archiveMonthRoute,
  formatDayNumber,
  formatLongDate,
  formatMonth,
  messages,
} from "../../src/i18n";
import styles from "./arquivo.module.css";

export function ArchiveBody({
  month,
  dates,
  months,
}: {
  readonly month: string;
  readonly dates: ReadonlySet<string>;
  readonly months: readonly string[];
}) {
  const copy = messages.archive;
  const { previous, next } = adjacentMonths(months, month);

  return (
    <>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
      </div>

      <section className={styles.section}>
        <ArchiveCalendar
          month={month}
          publishedDates={dates}
          previous={previous}
          next={next}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionHeading}>{copy.months.heading}</h2>
        <ul className={styles.months}>
          {months.map((each) => (
            <li key={each}>
              <Link
                className={styles.monthChip}
                href={archiveMonthRoute(each)}
                prefetch={false}
                aria-current={each === month ? "page" : undefined}
              >
                {formatMonth(`${each}-01`)}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ArchiveCalendar({
  month,
  publishedDates,
  previous,
  next,
}: {
  readonly month: string;
  readonly publishedDates: ReadonlySet<string>;
  readonly previous: string | undefined;
  readonly next: string | undefined;
}) {
  const copy = messages.archive.calendar;
  const { cells } = archiveCalendarMonth(month, publishedDates);

  return (
    <div className={styles.calendarCard}>
      <div className={styles.calendarHead}>
        <MonthStep month={previous} direction="previous" />
        <h2 className={styles.calendarMonth}>{formatMonth(`${month}-01`)}</h2>
        <MonthStep month={next} direction="next" />
      </div>
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

function MonthStep({
  month,
  direction,
}: {
  readonly month: string | undefined;
  readonly direction: "previous" | "next";
}) {
  const chevron = (
    <svg aria-hidden viewBox="0 0 16 16" className={styles.monthStepIcon}>
      <path d={direction === "previous" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
  if (month === undefined) {
    return (
      <span aria-hidden className={styles.monthStepOff}>
        {chevron}
      </span>
    );
  }

  const name = formatMonth(`${month}-01`);
  const copy = messages.archive.month;
  return (
    <Link
      className={styles.monthStep}
      href={archiveMonthRoute(month)}
      prefetch={false}
      scroll={false}
      aria-label={
        direction === "previous" ? copy.previousAria(name) : copy.nextAria(name)
      }
    >
      {chevron}
    </Link>
  );
}
