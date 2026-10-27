import Link from "next/link";
import { recordFor } from "@miolos/core";
import type { ReactNode } from "react";

import { AdSlot } from "../src/components/ad-slot";
import { BrandMark, Wordmark } from "../src/components/brand-mark";
import { GameThumbnail } from "../src/hub/game-thumbnail";
import {
  locale,
  messages,
  routes,
  SAO_PAULO_TIME_ZONE,
  todaySaoPauloDate,
} from "../src/i18n";
import { DAY_GAMES } from "../src/play/day-games";
import { HubAttach } from "./hub-attach";
import { HubBoard } from "./hub-board";
import { HubCardAction, HubProgress } from "./hub-day-state";
import { HubMenu } from "./hub-menu";
import { HubOnboarding } from "./hub-onboarding";
import { HubStreak } from "./hub-streak";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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

const CALENDAR_CELLS = Array.from({ length: 21 }, (_, cell) => cell);

function Door({
  id,
  href,
  kicker,
  title,
  lead,
  mark,
}: {
  id: string;
  href: string;
  kicker: string;
  title: string;
  lead: string;
  mark: ReactNode;
}) {
  return (
    <Link
      className={styles.door}
      href={href}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-lead`}
    >
      <span aria-hidden className={styles.doorTape} />
      <span aria-hidden className={styles.doorMark}>
        {mark}
      </span>
      <span className={styles.doorName}>
        <span className={styles.kicker}>{kicker}</span>
        <span id={`${id}-title`} className={styles.cardTitle}>
          {title}
        </span>
      </span>
      <span id={`${id}-lead`} className={styles.doorLead}>
        {lead}
      </span>
    </Link>
  );
}

export default function HojePage() {
  const now = new Date();
  const date = todayInSaoPaulo(now);
  const isoDate = todaySaoPauloDate(now);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.wordmark}>
              <Wordmark detailed />
            </h1>
            <p className={styles.tagline}>{messages.brand.tagline}</p>
            <p className={styles.date}>
              {date.weekday}{" "}
              <span className={styles.dateRest}>{date.rest}</span>
            </p>
            <HubProgress date={isoDate} />
          </div>

          <div className={styles.headerEnd}>
            <HubStreak />
            <HubMenu />
          </div>
        </header>

        <HubBoard
          key={isoDate}
          date={isoDate}
          cards={recordFor(DAY_GAMES, (game) => (
            <>
              <div aria-hidden className={styles.tape} />
              <span className={styles.thumb}>
                <GameThumbnail game={game} />
              </span>
              <div className={styles.cardBody}>
                <p className={styles.kicker}>{messages.games[game].kicker}</p>
                <h2 className={styles.gameTitle}>
                  {messages.games[game].name}
                </h2>
                <p className={styles.cardDescription}>
                  {messages.games[game].description}
                </p>
                <div className={styles.action}>
                  <HubCardAction game={game} date={isoDate} />
                </div>
              </div>
            </>
          ))}
        />

        <HubOnboarding />

        <HubAttach />

        <nav className={styles.doors} aria-label={messages.hoje.links.aria}>
          <Door
            id="hub-door-free-play"
            href={routes.freePlay}
            kicker={messages.hoje.links.freePlayKicker}
            title={messages.hoje.links.freePlay}
            lead={messages.hoje.links.freePlayLead}
            mark={
              <span className={styles.freePlayMark}>
                <span />
                <span />
                <span />
              </span>
            }
          />
          <Door
            id="hub-door-archive"
            href={routes.archive}
            kicker={messages.hoje.links.archiveKicker}
            title={messages.hoje.links.archive}
            lead={messages.hoje.links.archiveLead}
            mark={
              <span className={styles.archiveMark}>
                {CALENDAR_CELLS.map((cell) => (
                  <span key={cell} />
                ))}
              </span>
            }
          />
        </nav>

        <p className={styles.signOff}>
          <BrandMark className={styles.signOffMark} />
          {messages.brand.signOff}
        </p>

        <div className={styles.spacer} />

        <div className={styles.promoZoneDesktop}>
          <AdSlot placement="hub-desktop" />
        </div>
        <div className={styles.promoZoneMobile}>
          <AdSlot placement="hub-mobile" />
        </div>
      </main>

      <footer className={styles.footer}>
        <Link className={styles.footerLink} href={routes.privacy}>
          {messages.hoje.footer.privacy}
        </Link>
        <Link className={styles.footerLink} href={routes.terms}>
          {messages.hoje.footer.terms}
        </Link>
      </footer>
    </div>
  );
}
