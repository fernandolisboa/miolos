"use client";

import type { CSSProperties, ReactNode } from "react";

import {
  HUB_CARDS_ID,
  HUB_DONE_ID,
  holdScript,
  tuckScript,
} from "../src/hub/tuck";
import {
  TuckedGames,
  useHydrating,
  useSettledTuck,
} from "../src/hub/use-tucked";
import { messages } from "../src/i18n";
import { accentVars } from "../src/play/accent";
import { DAY_GAMES } from "../src/play/day-games";
import { DoneRow } from "./hub-day-state";
import styles from "./page.module.css";

type DayGame = (typeof DAY_GAMES)[number];

export function HubBoard({
  date,
  cards,
}: {
  readonly date: string;
  readonly cards: Readonly<Record<DayGame, ReactNode>>;
}) {
  const tucked = useSettledTuck(date);
  const hydrating = useHydrating();
  const left = DAY_GAMES.length - tucked.size;
  const grid: CSSProperties = { "--card-count": left };

  return (
    <TuckedGames value={tucked}>
      {hydrating && <script dangerouslySetInnerHTML={{ __html: holdScript }} />}
      <section
        id={HUB_CARDS_ID}
        className={styles.games}
        style={grid}
        hidden={left === 0}
        suppressHydrationWarning
      >
        {DAY_GAMES.map((game) => (
          <article
            key={game}
            data-hub-card={game}
            className={styles.card}
            style={accentVars(game)}
            hidden={tucked.has(game)}
            suppressHydrationWarning
          >
            {cards[game]}
          </article>
        ))}
      </section>

      <section
        id={HUB_DONE_ID}
        className={styles.doneToday}
        aria-labelledby={`${HUB_DONE_ID}-title`}
        hidden={tucked.size === 0}
        suppressHydrationWarning
      >
        <h2 id={`${HUB_DONE_ID}-title`} className={styles.kicker}>
          {messages.hoje.doneToday}
        </h2>
        <ul className={styles.doneList}>
          {DAY_GAMES.map((game) => (
            <li
              key={game}
              data-hub-done={game}
              className={styles.doneItem}
              style={accentVars(game)}
              hidden={!tucked.has(game)}
              suppressHydrationWarning
            >
              <DoneRow game={game} date={date} />
            </li>
          ))}
        </ul>
      </section>
      {hydrating && (
        <script dangerouslySetInnerHTML={{ __html: tuckScript(date) }} />
      )}
    </TuckedGames>
  );
}
