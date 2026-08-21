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

/**
 * The archive's calendar — ONE component, rendered by the index (the
 * newest archived month) and by every month page (#163, plan 065 D1/D3).
 * A second copy is how the two surfaces drift, exactly as it was for the
 * day rows this grid replaced.
 *
 * SERVER-RENDERED, ZERO CLIENT JS (plan 065 D5): plain `<Link>` anchors,
 * no `"use client"`, no hook, no clock. A cell is a link exactly when its
 * date is in `publishedDates` — the reader's own answer — so today,
 * future days, killed days and the ragged floor all render as the same
 * inert numeral with no code path of their own (ADR-0053 decision 3; a
 * bare numeral carries no puzzle content, so ADR-0004 has nothing to
 * object to). Today is NEVER linked: the day route would 307 it back to
 * the hub, and a link that bounces out of the archive is a surprise.
 *
 * `prefetch={false}` on every linked cell: a month is up to 31 links into
 * a `force-dynamic`, database-reading route family — the exact multiplier
 * ADR-0053 decision 2's revisit trigger watches. The measured cost (#31
 * step-6 group 5, against the real build): a prefetch of a
 * `force-dynamic` route returns a 160-byte tree and issues zero database
 * queries — small, and the guard stays because it costs nothing and the
 * bill becomes real the day `cacheComponents`/PPR is enabled. The guard
 * transferred here with the anatomy when the day rows went.
 *
 * Cell anatomy (plan 065 D3): linked and inert cells differ by THREE
 * carriers — border presence (geometry, survives greyscale), `--ink` vs
 * `--ink-2`, weight 600 vs 400 — and the link's accessible name carries
 * the meaning in words, so no carrier stands alone (`DESIGN.md:22` /
 * WCAG 1.4.1, colour is never the only carrier. NOT ADR-0041 decision 5,
 * which is about an accent border outlining an already-legible label: the
 * calendar paints no accent anywhere, and the citation was inherited from
 * the day rows this grid replaced, where there WAS an accent rule).
 * No per-day game names: they cannot fit a 44px tile, and the day page
 * one tap deeper carries them — the recorded design trade of #163.
 *
 * The weekday header is `aria-hidden` visual scaffolding (each link's own
 * name states its weekday, via `calendar.dayAria`); `role="list"` is
 * load-bearing, not redundant — `list-style: none` strips WebKit's list
 * semantics (the `stats-view.tsx` note). No roving focus: ADR-0030's
 * composite-widget pattern is for game boards, and ~31 tab stops equals
 * the row list this replaces.
 */
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
            // A pad cell has no identity beyond its grid position — the
            // stats calendar's own keying rule.
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
          // The `??` is the checker's price (noUncheckedIndexedAccess),
          // not a real branch: `index % WEEK_LENGTH` is always 0–6 and
          // `weekdaysLong` always holds seven strings.
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
