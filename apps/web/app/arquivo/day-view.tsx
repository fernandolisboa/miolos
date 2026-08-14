import type { Game } from "@miolos/core";
import Link from "next/link";

import { monthOf } from "../../src/archive/parse-params";
import {
  archiveGameRoute,
  archiveMonthRoute,
  formatLongDate,
  formatMonth,
  messages,
} from "../../src/i18n";
import { accentVars } from "../../src/play/accent";
import styles from "./arquivo.module.css";

/**
 * One archived day (#31, ADR-0053 decision 1) — the games that date actually
 * holds, one card each, plus a link up to its month.
 *
 * This is the ONE archive surface where a card is right: each card is a
 * distinct destination with its own identity, and there are at most four of
 * them. The index and the month pages use hairline-separated rows instead,
 * because a day row inside a card inside a section is exactly how
 * card-inside-card happens — an anti-reference the brief names.
 *
 * A short date renders fewer cards and nothing else: no placeholder, no
 * greyed slot. A `killed_at` takedown produces exactly the same shape.
 */
export function ArchiveDayView({
  date,
  games,
}: {
  readonly date: string;
  readonly games: readonly Game[];
}) {
  const copy = messages.archive;
  const longDate = formatLongDate(date);
  const month = monthOf(date);

  return (
    <main className={styles.page} data-page="arquivo-dia">
      <header className={styles.topBar}>
        <Link
          className={styles.back}
          href={archiveMonthRoute(month)}
          aria-label={copy.backToMonthAria(formatMonth(`${month}-01`))}
        >
          {copy.backToMonth(formatMonth(`${month}-01`))}
        </Link>
        <span className={styles.wordmark}>{messages.brand.wordmark}</span>
        <span className={styles.barKicker}>{copy.title}</span>
      </header>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{longDate}</h1>
      </div>

      <ul className={styles.cards}>
        {games.map((game, index) => (
          <li key={game}>
            <Link
              className={`${styles.card} ${
                index % 2 === 0 ? styles.cardOdd : styles.cardEven
              }`}
              style={accentVars(game)}
              href={archiveGameRoute(date, game)}
              prefetch={false}
              aria-label={copy.day.cardAria(
                messages.games[game].name,
                longDate,
              )}
            >
              {/* Decoration with nothing to announce. */}
              <span aria-hidden className={styles.tape} />
              <p className={styles.cardKicker}>{messages.games[game].kicker}</p>
              <p className={styles.cardTitle}>{messages.games[game].name}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className={styles.spacer} />
    </main>
  );
}
