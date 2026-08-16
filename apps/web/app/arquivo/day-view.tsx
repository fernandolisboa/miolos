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
import { ArchiveDayCard } from "./day-card";
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
 *
 * THIS STAYS A SERVER COMPONENT and stays the owner of `<main>`, the top bar,
 * the `<h1>` and the `<ul>`. Only the card is a client island (#96,
 * ADR-0056), and every string it needs — the three accessible names and the
 * two chip words — is composed HERE and crosses as a finished string
 * (ADR-0018). No composer crosses the boundary; `archiveGameRoute` stays on
 * this side for the same reason, since it rides the `src/i18n` barrel that
 * also re-exports `messages`.
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
            <ArchiveDayCard
              game={game}
              date={date}
              index={index}
              name={messages.games[game].name}
              kicker={messages.games[game].kicker}
              href={archiveGameRoute(date, game)}
              cardAria={copy.day.cardAria(messages.games[game].name, longDate)}
              cardAriaDone={copy.day.cardAriaDone(
                messages.games[game].name,
                longDate,
              )}
              cardAriaPlayed={copy.day.cardAriaPlayed(
                messages.games[game].name,
                longDate,
              )}
              done={copy.day.done}
              played={copy.day.played}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
