"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  adjacentPeriods,
  archiveYears,
  publishedYears,
  yearMonths,
} from "../../src/archive/calendar";
import {
  archiveMonthRoute,
  formatMonth,
  formatMonthShort,
  messages,
} from "../../src/i18n";
import styles from "./arquivo.module.css";

type View = "days" | "months" | "years";

type Focus = "title" | "cell" | undefined;

const PARENT: Record<View, View> = {
  days: "days",
  months: "days",
  years: "months",
};

export function CalendarPicker({
  month,
  months,
  children,
}: {
  readonly month: string;
  readonly months: readonly string[];
  readonly children: ReactNode;
}) {
  const [view, setView] = useState<View>("days");
  const [year, setYear] = useState(() => month.slice(0, 4));
  const pendingFocus = useRef<Focus>(undefined);
  const titleRef = useRef<HTMLButtonElement>(null);
  const monthsRef = useRef<HTMLUListElement>(null);
  const yearsRef = useRef<HTMLUListElement>(null);
  const hintId = useId();

  useEffect(() => {
    const focus = pendingFocus.current;
    pendingFocus.current = undefined;
    if (focus === "title") {
      titleRef.current?.focus();
    } else if (focus === "cell") {
      const panel = view === "years" ? yearsRef.current : monthsRef.current;
      const target =
        panel?.querySelector<HTMLElement>('[aria-current="true"]') ??
        panel?.querySelector<HTMLElement>("a, button");
      target?.focus();
    }
  }, [view, year]);

  const show = (next: View, focus: Focus, nextYear = year) => {
    pendingFocus.current = focus;
    setYear(nextYear);
    setView(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && view !== "days") {
      event.preventDefault();
      show(PARENT[view], "title");
    }
  };

  const stepYear = (step: string, direction: "previous" | "next") => {
    const further = adjacentPeriods(publishedYears(months), step)[direction];
    show("months", further === undefined ? "title" : undefined, step);
  };

  const onMonth = (event: MouseEvent, period: string) => {
    if (period === month) {
      event.preventDefault();
      show("days", "title");
    }
  };

  const off = (panel: View) =>
    panel === view ? {} : { inert: true, "aria-hidden": true, "data-off": "" };

  const years = archiveYears(months);
  const yearSteps = adjacentPeriods(publishedYears(months), year);
  const copy = messages.archive.picker;

  return (
    <div className={styles.calendarCard} onKeyDown={onKeyDown}>
      <div className={styles.calendarHead}>
        {view === "days" ? (
          <MonthStep months={months} month={month} direction="previous" />
        ) : (
          <YearStep
            year={view === "months" ? yearSteps.previous : undefined}
            direction="previous"
            onStep={(step) => stepYear(step, "previous")}
          />
        )}
        <h2 className={styles.calendarMonth}>
          {view === "years" ? (
            yearRange(years)
          ) : (
            <button
              ref={titleRef}
              type="button"
              className={styles.calendarTitle}
              aria-describedby={hintId}
              onClick={() =>
                view === "days"
                  ? show("months", "cell", month.slice(0, 4))
                  : show("years", "cell")
              }
            >
              {view === "days" ? formatMonth(`${month}-01`) : year}
              <svg aria-hidden viewBox="0 0 16 16" className={styles.titleIcon}>
                <path d="M4 6l4 4 4-4" />
              </svg>
            </button>
          )}
        </h2>
        {view === "days" ? (
          <MonthStep months={months} month={month} direction="next" />
        ) : (
          <YearStep
            year={view === "months" ? yearSteps.next : undefined}
            direction="next"
            onStep={(step) => stepYear(step, "next")}
          />
        )}
      </div>

      <span id={hintId} className={styles.titleHint}>
        {view === "days" ? copy.monthsHint : copy.yearsHint}
      </span>

      <div className={styles.calendarViews}>
        <div {...off("days")}>{children}</div>

        <ul
          ref={monthsRef}
          role="list"
          className={styles.periodGrid}
          {...off("months")}
        >
          {yearMonths(year, months).map((cell) => (
            <li key={cell.period}>
              {cell.linked ? (
                <Link
                  className={styles.periodCellLink}
                  href={archiveMonthRoute(cell.period)}
                  prefetch={false}
                  scroll={false}
                  aria-label={formatMonth(`${cell.period}-01`)}
                  aria-current={cell.period === month ? "true" : undefined}
                  onClick={(event) => onMonth(event, cell.period)}
                >
                  {formatMonthShort(`${cell.period}-01`)}
                </Link>
              ) : (
                <span aria-hidden className={styles.periodCellInert}>
                  {formatMonthShort(`${cell.period}-01`)}
                </span>
              )}
            </li>
          ))}
        </ul>

        <ul
          ref={yearsRef}
          role="list"
          className={styles.periodGrid}
          {...off("years")}
        >
          {years.map((cell) => (
            <li key={cell.period}>
              {cell.linked ? (
                <button
                  type="button"
                  className={styles.periodCellLink}
                  aria-current={cell.period === year ? "true" : undefined}
                  onClick={() => show("months", "cell", cell.period)}
                >
                  {cell.period}
                </button>
              ) : (
                <span aria-hidden className={styles.periodCellInert}>
                  {cell.period}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function yearRange(years: readonly { readonly period: string }[]): string {
  const first = years[0]?.period ?? "";
  const last = years.at(-1)?.period ?? first;
  return first === last ? first : `${first}–${last}`;
}

function Chevron({ direction }: { readonly direction: "previous" | "next" }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={styles.monthStepIcon}>
      <path d={direction === "previous" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
}

function StepOff({ direction }: { readonly direction: "previous" | "next" }) {
  return (
    <span aria-hidden className={styles.monthStepOff}>
      <Chevron direction={direction} />
    </span>
  );
}

function MonthStep({
  months,
  month,
  direction,
}: {
  readonly months: readonly string[];
  readonly month: string;
  readonly direction: "previous" | "next";
}) {
  const target = adjacentPeriods(months, month)[direction];
  if (target === undefined) {
    return <StepOff direction={direction} />;
  }

  const name = formatMonth(`${target}-01`);
  const copy = messages.archive.month;
  return (
    <Link
      className={styles.monthStep}
      href={archiveMonthRoute(target)}
      prefetch={false}
      scroll={false}
      aria-label={
        direction === "previous" ? copy.previousAria(name) : copy.nextAria(name)
      }
    >
      <Chevron direction={direction} />
    </Link>
  );
}

function YearStep({
  year,
  direction,
  onStep,
}: {
  readonly year: string | undefined;
  readonly direction: "previous" | "next";
  readonly onStep: (year: string) => void;
}) {
  if (year === undefined) {
    return <StepOff direction={direction} />;
  }

  const copy = messages.archive.picker;
  return (
    <button
      type="button"
      className={styles.monthStep}
      aria-label={
        direction === "previous"
          ? copy.previousYearAria(year)
          : copy.nextYearAria(year)
      }
      onClick={() => onStep(year)}
    >
      <Chevron direction={direction} />
    </button>
  );
}
