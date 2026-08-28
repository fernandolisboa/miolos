import Link from "next/link";

import { FREE_PLAY_GAMES } from "../../src/free-play/catalog";
import { freePlayRoutes, messages, routes } from "../../src/i18n";
import { accentVars } from "../../src/play/accent";
import styles from "./page.module.css";

export default function FreePlayIndexPage() {
  return (
    <main className={styles.page} data-free-play="index">
      <header className={styles.topBar}>
        <Link
          className={styles.back}
          href={routes.home}
          aria-label={messages.play.backAria}
        >
          {messages.play.back}
        </Link>
        <span className={styles.wordmark}>{messages.brand.wordmark}</span>
      </header>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{messages.freePlay.title}</h1>
        <p className={styles.lead}>{messages.freePlay.lead}</p>
      </div>

      <section className={styles.games}>
        {FREE_PLAY_GAMES.map((game) => (
          <Link
            key={game}
            className={styles.card}
            href={freePlayRoutes[game]}
            style={accentVars(game)}
          >
            <span aria-hidden className={styles.tape} />
            <span className={styles.cardBody}>
              <span className={styles.kicker}>
                {messages.games[game].kicker}
              </span>
              <span className={styles.cardTitle}>
                {messages.games[game].name}
              </span>
              <span className={styles.cardDescription}>
                {messages.games[game].description}
              </span>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
