import Link from "next/link";

import { messages, routes } from "../../src/i18n";
import styles from "./page.module.css";
import { StatsView } from "./stats-view";

/**
 * The statistics screen (#29, ADR-0051) — the /privacidade static register:
 * STATIC on purpose, no `dynamic` export, no db import, no fetch in the
 * server component. Every aggregate is server-computed behind
 * `requireUserId` (`GET /stats`, `GET /stats/calendar` — ADR-0014 keeps
 * them in apps/api), so the data arrives through the client island's
 * mount-effect hooks only and the server markup and the pre-hydration
 * paint agree byte-for-byte (§6.6). `SessionBootstrap` already mounts in
 * the root layout — nothing to add here.
 */
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

      {/* The island owns the whole data composition: summary → #30's
          medal section → per-game blocks → calendar (plan 033 D10's
          screen order — the medal section lives at that exact seam
          inside stats-view.tsx, ADR-0052). */}
      <StatsView />
    </main>
  );
}
