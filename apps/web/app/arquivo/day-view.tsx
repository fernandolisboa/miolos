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
