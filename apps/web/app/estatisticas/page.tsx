import Link from "next/link";

import { messages, routes } from "../../src/i18n";
import styles from "./page.module.css";
import { StatsView } from "./stats-view";

export default function StatsPage() {
  return (
    <main className={styles.page} data-page="estatisticas">
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
        <h1 className={styles.title}>{messages.stats.title}</h1>
      </div>

      <StatsView />
    </main>
  );
}
