import { messages } from "../../src/i18n";
import { PageTopBar } from "../../src/components/page-top-bar";
import styles from "./page.module.css";
import { StatsView } from "./stats-view";

export default function StatsPage() {
  return (
    <main className={styles.page} data-page="estatisticas">
      <PageTopBar />

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{messages.stats.title}</h1>
      </div>

      <StatsView />
    </main>
  );
}
