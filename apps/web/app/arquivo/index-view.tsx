import Link from "next/link";

import type { ArchiveDayGroup } from "../../src/archive/group-days";
import {
  archiveMonthRoute,
  formatMonth,
  messages,
  routes,
} from "../../src/i18n";
import styles from "./arquivo.module.css";
import { DayRows } from "./day-rows";

/**
 * The archive index (#31, ADR-0053 decision 1) — the seven most recent
 * archived days as day rows, then every month that holds an archived day,
 * newest first.
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
  recent,
  months,
}: {
  readonly recent: readonly ArchiveDayGroup[];
  readonly months: readonly string[];
}) {
  const copy = messages.archive;
  const empty = recent.length === 0 && months.length === 0;

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
        <p className={styles.lead}>{copy.lead}</p>
      </div>

      {empty ? (
        /* HTTP 200 with its marker, never a 404 and never a skeleton: the
           resource exists and is empty (ADR-0053 decision 3 — the archive
           starts when the first daily is published). */
        <p className={styles.empty}>{copy.empty}</p>
      ) : (
        <>
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>{copy.recent.heading}</h2>
            <DayRows groups={recent} />
          </section>

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

      <div className={styles.spacer} />
    </main>
  );
}
