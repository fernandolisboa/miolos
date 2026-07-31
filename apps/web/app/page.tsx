import { AdSlot } from "../src/components/ad-slot";
import { locale, messages } from "../src/i18n";
import styles from "./page.module.css";

// The date must be today's (America/São Paulo), not build-day's.
export const dynamic = "force-dynamic";

const gameOrder = ["termo", "sudoku", "nonogram", "binairo"] as const;

const gameAccents: Record<(typeof gameOrder)[number], string> = {
  termo: "var(--accent-termo)",
  sudoku: "var(--accent-sudoku)",
  nonogram: "var(--accent-nonogram)",
  binairo: "var(--accent-binairo)",
};

function todayInSaoPaulo(): { weekday: string; rest: string } {
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  // "sexta-feira, 31 de julho de 2026" — split so mobile can break the
  // line after the weekday comma, per the reference frames.
  const commaIndex = formatted.indexOf(",");
  if (commaIndex === -1) {
    return { weekday: formatted, rest: "" };
  }
  return {
    weekday: formatted.slice(0, commaIndex + 1),
    rest: formatted.slice(commaIndex + 1).trim(),
  };
}

export default function HojePage() {
  const date = todayInSaoPaulo();
  const streakCount = 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.wordmark}>{messages.hoje.wordmark}</h1>
          <p className={styles.date}>
            {date.weekday} <span className={styles.dateRest}>{date.rest}</span>
          </p>
          <p className={`${styles.metaLine} tabular-nums`}>
            {messages.hoje.completedOfTotal(0, gameOrder.length)}
          </p>
        </div>
        <div
          className={styles.streakStamp}
          aria-label={messages.hoje.streak.aria(streakCount)}
        >
          <div aria-hidden className={`${styles.streakNumeral} tabular-nums`}>
            {streakCount}
          </div>
          <div aria-hidden className={styles.streakLabel}>
            {messages.hoje.streak.label}
          </div>
        </div>
      </header>

      <section className={styles.games}>
        {gameOrder.map((game) => (
          <article
            key={game}
            className={styles.card}
            style={{ "--accent": gameAccents[game] }}
          >
            <div aria-hidden className={styles.tape} />
            <div className={styles.cardBody}>
              <p className={styles.kicker}>
                {messages.hoje.games[game].kicker}
              </p>
              <h2 className={styles.cardTitle}>
                {messages.hoje.games[game].name}
              </h2>
              <p className={styles.cardDescription}>
                {messages.hoje.games[game].description}
              </p>
            </div>
            {/* Placeholder anchor without href: the game routes do not exist
                yet, and a dead href would be fake navigation. */}
            <a className={styles.cta}>
              <span className={styles.ctaLong}>{messages.hoje.playCta}</span>
              <span className={styles.ctaShort}>
                {messages.hoje.playCtaShort}
              </span>
            </a>
          </article>
        ))}
      </section>

      <nav className={styles.secondaryLinks}>
        <a className={styles.secondaryLink}>{messages.hoje.links.archive}</a>
        <a className={styles.secondaryLink}>{messages.hoje.links.freePlay}</a>
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
