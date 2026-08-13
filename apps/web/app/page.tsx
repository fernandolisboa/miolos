import Link from "next/link";

import { AdSlot } from "../src/components/ad-slot";
import { locale, messages, routes } from "../src/i18n";
import { accentVars } from "../src/play/accent";
import { HubCardAction, HubProgress } from "./hub-day-state";
import { HubStreak } from "./hub-streak";
import styles from "./page.module.css";

// The date must be today's (America/São Paulo), not build-day's.
export const dynamic = "force-dynamic";

/**
 * The day's rollover, fixed for every user (CONTEXT.md "Rollover"). Declared
 * once here rather than imported from `@miolos/db`: the hub reads no
 * database, and pulling the driver in for a string would be a real cost.
 */
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

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

/**
 * Today's São Paulo calendar day, 'YYYY-MM-DD' — the key this device's day
 * state is read under (ADR-0031), and the same day `/binairo` and `/sudoku`
 * resolve from the published-puzzle wall.
 *
 * Derived from the SERVER's clock, on a `force-dynamic` segment: the browser's
 * clock never selects which day the hub is showing (CONTEXT.md "Rollover").
 * Assembled from the typed parts rather than from a formatted string, because
 * `locale` is pt-BR and would print 31/07/2026; the parts are numeric in every
 * locale, so no second locale is introduced for a machine-readable value. A
 * missing part cannot happen for these options, and if it ever did the date
 * would simply match no stored record and every tile would read pending — the
 * monotone-safe direction (ADR-0031).
 */
function todaySaoPauloDate(now: Date): string {
  const parts = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: SAO_PAULO_TIME_ZONE,
  }).formatToParts(now);
  const field = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${field("year")}-${field("month")}-${field("day")}`;
}

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
            {/* Done or pending, per THIS DEVICE (plan 018 §11.3, ADR-0031),
                and linked through the `playRoutes` map — #27 added termo as
                a KEY rather than a branch, which is what kept this JSX
                untouched by a fourth game. */}
            <HubCardAction game={game} date={isoDate} />
          </article>
        ))}
      </section>

      <nav className={styles.secondaryLinks}>
        {/* Arquivo and Estatísticas stay href-less until #31/#29 land their
            routes — a dead href would be fake navigation (the hub rule the
            done tile documents). Modo livre is real since #28. */}
        <a className={styles.secondaryLink}>{messages.hoje.links.archive}</a>
        <Link className={styles.secondaryLink} href={routes.freePlay}>
          {messages.hoje.links.freePlay}
        </Link>
        <a className={styles.secondaryLink}>{messages.hoje.links.stats}</a>
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
