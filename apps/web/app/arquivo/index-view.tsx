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
 * The archive index (#31, ADR-0053 decision 1; the calendar since #163,
 * plan 065 D1) — the NEWEST archived month as a clickable calendar, then
 * every month that holds an archived day, newest first, as chips.
 *
 * ONE month's grid, never all of them: every month as a grid would make
 * the index's read unbounded and its height grow forever — the seasonal
 * overflow shape this sheet's own `.page` comment records — while one
 * grid plus the chips keeps every read bounded by construction (ADR-0053
 * decision 4) and any other month one tap away. The chips are also the
 * visual gate's URL discovery source: the workflow greps this page's body
 * for the first `/arquivo/mes/YYYY-MM` href, so a redesign that dropped
 * every month link would silently skip the date-bearing scans — the
 * rewritten T-WEB-S167 pins that at least one such href stays.
 *
 * Synchronous and props-only, so tests render it directly: React Testing
 * Library cannot render an async server component, and the page above it is
 * a reader call plus a branch (the `app/sudoku/page.tsx` register).
 *
 * ONE static rotation on nothing and NO washi tape: tape marks a game, and
 * the index is not a game. The archive's texture is the desk dot pattern and
 * the hairlines — stated so nobody adds tape here for texture.
 */
export function ArchiveIndexView({
  calendar,
  months,
}: {
  readonly calendar:
    { readonly month: string; readonly dates: readonly string[] } | undefined;
  readonly months: readonly string[];
}) {
  const copy = messages.archive;
  const empty = calendar === undefined && months.length === 0;

  return (
    <main className={styles.page} data-page="arquivo">
      <header className={styles.topBar}>
        <Link
          className={styles.back}
          href={routes.home}
          aria-label={messages.play.backAria}
        >
          {messages.play.back}
        </Link>
        <span className={styles.wordmark}>{messages.brand.wordmark}</span>
        <span className={styles.barKicker}>{copy.title}</span>
      </header>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{copy.title}</h1>
        {/* SUPPRESSED WHEN EMPTY (step-6 F10d). The lead promises "todos os
            puzzles do dia desde o começo" and `copy.empty` says there are
            none; stacked 40px apart in the same 15px `--ink-2`, the page
            promised everything and then said there was nothing. The empty
            state's own sentence is the whole message there. */}
        {empty ? null : <p className={styles.lead}>{copy.lead}</p>}
      </div>

      {empty ? (
        /* HTTP 200 with its marker, never a 404 and never a skeleton grid:
           the resource exists and is empty (ADR-0053 decision 3 — the
           archive starts when the first daily is published). */
        <p className={styles.empty}>{copy.empty}</p>
      ) : (
        <>
          {calendar === undefined ? null : (
            <section className={styles.section}>
              {/* The month name is the section's own heading — headings are
                  exempt from the all-caps gate and not uppercase anyway —
                  and the grid carries bare numerals under it. A sparse
                  newest month (one linked day on the 2nd) is the ragged
                  floor's own shape, not an edge case (ADR-0053 D3). */}
              <h2 className={styles.sectionHeading}>
                {formatMonth(`${calendar.month}-01`)}
              </h2>
              <ArchiveCalendar
                month={calendar.month}
                publishedDates={new Set(calendar.dates)}
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
