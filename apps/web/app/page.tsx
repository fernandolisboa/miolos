import Link from "next/link";

import { AdSlot } from "../src/components/ad-slot";
import {
  locale,
  messages,
  routes,
  SAO_PAULO_TIME_ZONE,
  todaySaoPauloDate,
} from "../src/i18n";
import { accentVars } from "../src/play/accent";
import { HubAttach } from "./hub-attach";
import { HubCardAction, HubProgress } from "./hub-day-state";
import { HubOnboarding } from "./hub-onboarding";
import { HubStreak } from "./hub-streak";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const gameOrder = ["termo", "sudoku", "nonogram", "binairo"] as const;

function todayInSaoPaulo(now: Date): { weekday: string; rest: string } {
  const parts = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(now);

  const weekdayIndex = parts.findIndex((part) => part.type === "weekday");
  const weekdayPart = parts[weekdayIndex];
  if (!weekdayPart) {
    return {
      weekday: parts.map((part) => part.value).join(""),
      rest: "",
    };
  }

  const separator = parts[weekdayIndex + 1];
  const separatorIsLiteral = separator?.type === "literal";
  return {
    weekday: `${weekdayPart.value}${separatorIsLiteral ? separator.value.trim() : ""}`,
    rest: parts
      .slice(weekdayIndex + (separatorIsLiteral ? 2 : 1))
      .map((part) => part.value)
      .join("")
      .trim(),
  };
}

export default function HojePage() {
  const now = new Date();
  const date = todayInSaoPaulo(now);
  const isoDate = todaySaoPauloDate(now);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.wordmark}>{messages.brand.wordmark}</h1>
          <p className={styles.date}>
            {date.weekday} <span className={styles.dateRest}>{date.rest}</span>
          </p>
          <HubProgress date={isoDate} total={gameOrder.length} />
        </div>

        <HubStreak />
      </header>

      <section className={styles.games}>
        {gameOrder.map((game) => (
          <article key={game} className={styles.card} style={accentVars(game)}>
            <div aria-hidden className={styles.tape} />
            <div className={styles.cardBody}>
              <p className={styles.kicker}>{messages.games[game].kicker}</p>
              <h2 className={styles.cardTitle}>{messages.games[game].name}</h2>
              <p className={styles.cardDescription}>
                {messages.games[game].description}
              </p>
            </div>

            <HubCardAction game={game} date={isoDate} />
          </article>
        ))}
      </section>

      <HubOnboarding />

      <HubAttach />

      <nav className={styles.secondaryLinks}>
        <Link className={styles.secondaryLink} href={routes.archive}>
          {messages.hoje.links.archive}
        </Link>
        <Link className={styles.secondaryLink} href={routes.freePlay}>
          {messages.hoje.links.freePlay}
        </Link>
        <Link className={styles.secondaryLink} href={routes.stats}>
          {messages.hoje.links.stats}
        </Link>
        <Link className={styles.secondaryLink} href={routes.privacy}>
          {messages.hoje.links.privacy}
        </Link>
        <Link className={styles.secondaryLink} href={routes.terms}>
          {messages.hoje.links.terms}
        </Link>
      </nav>

      <div className={styles.spacer} />

      <div className={styles.promoZoneDesktop}>
        <AdSlot placement="hub-desktop" />
      </div>
      <div className={styles.promoZoneMobile}>
        <AdSlot placement="hub-mobile" />
      </div>
    </main>
  );
}
