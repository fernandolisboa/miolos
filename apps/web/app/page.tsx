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

// The date must be today's (America/São Paulo), not build-day's.
export const dynamic = "force-dynamic";

const gameOrder = ["termo", "sudoku", "nonogram", "binairo"] as const;

function todayInSaoPaulo(now: Date): { weekday: string; rest: string } {
  const parts = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(now);
  // "sexta-feira, 31 de julho de 2026" — split on the typed weekday part
  // (not a comma guess) so mobile can break the line after the weekday,
  // per the reference frames.
  const weekdayIndex = parts.findIndex((part) => part.type === "weekday");
  const weekdayPart = parts[weekdayIndex];
  if (!weekdayPart) {
    return {
      weekday: parts.map((part) => part.value).join(""),
      rest: "",
    };
  }
  // The literal after the weekday is ", " — its comma stays on the weekday
  // line; the whitespace becomes the gap between the two rendered spans.
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

// `todaySaoPauloDate` (src/i18n/sao-paulo-day.ts, the step-6 F7 hoist) is
// fed the SERVER's `now` below — this segment is `force-dynamic`, so the
// browser's clock never selects which day the hub is showing.
export default function HojePage() {
  // One instant for both readings: two `new Date()` calls a microsecond apart
  // can straddle the rollover and put a date on the tiles that the masthead
  // contradicts.
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
        {/* Server-computed and client-fetched (ADR-0048): the server render
            shows the honest 0 and hydration only ever raises it. */}
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
            {/* Done or pending, per this device AND the server (plan 018
                §11.3, ADR-0031 as amended by ADR-0060 — since #83 a game
                completed on another device reads done here too), and linked
                through the `playRoutes` map — #27 added termo as a KEY
                rather than a branch, which is what kept this JSX untouched
                by a fourth game. */}
            <HubCardAction game={game} date={isoDate} />
          </article>
        ))}
      </section>

      {/* The first-visit introduction (#35, ADR-0061). In the hub's flow
          DIRECTLY after the game cards, never a modal — the same slot and
          the same rule as HubAttach, and for a reason this ticket had to
          learn: the island materialises post-hydration, after the mint and
          the state read, so anything below it moves. Above the grid that
          would be the four "Jogar hoje" links moving out from under a
          first-time player's finger — the one acceptance criterion this
          surface most needs not to violate. It sits BEFORE HubAttach
          (step-6 issue-lens finding, plan 057 §4): if an unacknowledged
          intro and an eligible attach prompt ever co-occur, the product
          introduction must not render below the attach ask. Renders null
          until GET /onboarding/state says show, so the server render and
          the pre-hydration paint are unchanged (T-WEB-S127). */}
      <HubOnboarding />

      {/* In the hub's flow after the game cards, never a modal (D15). The
          island renders null until GET /attach/state says eligible, so the
          server render and impeccable's clean profile are unchanged. */}
      <HubAttach />

      <nav className={styles.secondaryLinks}>
        {/* Every one of the five now has a real target, and that is what
            earns the href — Privacidade since #21, Modo livre since #28,
            Estatísticas since #29, Arquivo since #31 and Termos since #158
            (a dead href would be fake navigation, the hub rule the done
            tile documents). */}
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
