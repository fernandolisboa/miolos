"use client";

import type { CalendarDay, DayMark, FullDaysResponse } from "@miolos/core";

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

export function StatsCalendar({
  fullDays,
}: {
  readonly fullDays: FullDaysResponse | null | undefined;
}) {
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
  const markOf = dayMarks(calendar?.days ?? [], fullDays?.dates ?? []);
  const shownMarks = MARKS.filter((mark) =>
    [...markOf.values()].includes(mark),
  );
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
          {shownMarks.map((mark) => (
            <span key={mark} className={styles.legendItem}>
              <span
                aria-hidden
                className={styles.legendSwatch}
                data-state="onTime"
              >
                <span className={styles.mark} data-mark={mark} />
              </span>
              {copy.markLegend[mark]}
            </span>
          ))}
        </div>
      )}
      <div className={styles.months}>
        {months.map((month) => (
          <MonthGrid
            key={month.month}
            month={month}
            today={today}
            markOf={markOf}
          />
        ))}
      </div>
    </section>
  );
}

function MonthGrid({
  month,
  today,
  markOf,
}: {
  readonly month: CalendarMonth;
  readonly today: string;
  readonly markOf: ReadonlyMap<string, DayMark>;
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
            <DayCell
              key={cell.date}
              cell={cell}
              today={cell.date === today}
              mark={markOf.get(cell.date)}
            />
          ),
        )}
      </div>
    </div>
  );
}

function DayCell({
  cell,
  today,
  mark,
}: {
  readonly cell: CalendarCell;
  readonly today: boolean;
  readonly mark: DayMark | undefined;
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
      aria-label={dayAria(day, mark)}
      className={styles.day}
      data-state={day.state}
      data-mark={mark}
      data-today={today ? "" : undefined}
    >
      {numeral}
      {mark !== undefined && (
        <span aria-hidden className={styles.mark} data-mark={mark} />
      )}
    </span>
  );
}

const MARKS = ["full", "perfect"] as const satisfies readonly DayMark[];

function dayMarks(
  days: readonly CalendarDay[],
  fullDates: readonly string[],
): ReadonlyMap<string, DayMark> {
  const full = new Set(fullDates);
  const marks = new Map<string, DayMark>();
  for (const day of days) {
    if (day.perfect) {
      marks.set(day.date, "perfect");
    } else if (day.state === "onTime" && full.has(day.date)) {
      marks.set(day.date, "full");
    }
  }
  return marks;
}

function dayAria(day: CalendarDay, mark: DayMark | undefined): string {
  const date = formatLongDate(day.date);
  const aria = messages.stats.calendar.dayAria;
  if (day.state === "onTime") {
    return mark === "perfect"
      ? aria.onTimePerfect(date)
      : mark === "full"
        ? aria.onTimeFull(date)
        : aria.onTime(date);
  }
  return day.state === "late" ? aria.late(date) : aria.missed(date);
}
