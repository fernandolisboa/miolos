"use client";

import type { CalendarDay } from "@miolos/core";

import {
  formatDayNumber,
  formatLongDate,
  formatMonth,
  messages,
  todaySaoPauloDate,
} from "../../src/i18n";
import {
  calendarMonths,
  neutralMonth,
  type CalendarCell,
  type CalendarMonth,
} from "../../src/stats/calendar-month";
import { useStatsCalendar } from "../../src/stats/use-stats-calendar";
import pageStyles from "./page.module.css";
import styles from "./stats-calendar.module.css";

export function StatsCalendar() {
  const calendar = useStatsCalendar();
  const copy = messages.stats.calendar;
  if (calendar === undefined) {
    return (
      <section className={styles.calendar} data-stats-state="skeleton">
        <h2 className={pageStyles.sectionHeading}>{copy.title}</h2>
        <div aria-hidden className={styles.calendarSkeleton} />
      </section>
    );
  }

  const today = todaySaoPauloDate(new Date());
  const months =
    calendar === null ? [neutralMonth(today)] : calendarMonths(calendar.days);
  return (
    <section className={styles.calendar} data-stats-state="value">
      <h2 className={pageStyles.sectionHeading}>{copy.title}</h2>

      {calendar !== null && (
        <div className={styles.legend}>
          {(["onTime", "late", "missed"] as const).map((state) => (
            <span key={state} className={styles.legendItem}>
              <span
                aria-hidden
                className={styles.legendSwatch}
                data-state={state}
              />
              {copy.legend[state]}
            </span>
          ))}
        </div>
      )}
      <div className={styles.months}>
        {months.map((month) => (
          <MonthGrid key={month.month} month={month} today={today} />
        ))}
      </div>
    </section>
  );
}

function MonthGrid({
  month,
  today,
}: {
  readonly month: CalendarMonth;
  readonly today: string;
}) {
  return (
    <div className={styles.month}>
      <h3 className={styles.monthTitle}>{formatMonth(month.month)}</h3>
      <div aria-hidden className={styles.weekdays}>
        {messages.stats.calendar.weekdays.map((weekday, index) => (
          <span key={index} className={styles.weekday}>
            {weekday}
          </span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {month.cells.map((cell, index) =>
          cell === null ? (
            <span key={index} aria-hidden className={styles.dayPad} />
          ) : (
            <DayCell key={cell.date} cell={cell} today={cell.date === today} />
          ),
        )}
      </div>
    </div>
  );
}

function DayCell({
  cell,
  today,
}: {
  readonly cell: CalendarCell;
  readonly today: boolean;
}) {
  const numeral = (
    <span aria-hidden className={`${styles.dayNumeral} tabular-nums`}>
      {formatDayNumber(cell.date)}
    </span>
  );
  if (cell.day === undefined) {
    return (
      <span aria-hidden className={styles.day}>
        {numeral}
      </span>
    );
  }

  const { day } = cell;
  return (
    <span
      role="img"
      aria-label={dayAria(day)}
      className={styles.day}
      data-state={day.state}
      data-perfect={day.perfect ? "" : undefined}
      data-today={today ? "" : undefined}
    >
      {numeral}
      {day.perfect && <span aria-hidden className={styles.perfectMark} />}
    </span>
  );
}

function dayAria(day: CalendarDay): string {
  const date = formatLongDate(day.date);
  const aria = messages.stats.calendar.dayAria;
  if (day.state === "onTime") {
    return day.perfect ? aria.onTimePerfect(date) : aria.onTime(date);
  }
  return day.state === "late" ? aria.late(date) : aria.missed(date);
}
