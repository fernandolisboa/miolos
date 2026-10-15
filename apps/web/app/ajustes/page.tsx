import type { Metadata } from "next";
import Link from "next/link";

import { PageTopBar } from "../../src/components/page-top-bar";
import { deleteAccountAnchor, messages, routes } from "../../src/i18n";
import { AccountSection } from "./account-section";
import { GamesSection } from "./games-section";
import { GoogleSection } from "./google-section";
import styles from "./page.module.css";
import { ReminderSection } from "./reminder-section";
import { ThemeSection } from "./theme-section";

export const metadata: Metadata = {
  title: `${messages.settings.title} — ${messages.brand.wordmark}`,
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  const copy = messages.settings;
  return (
    <main className={styles.page} data-page="ajustes">
      <PageTopBar />

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
      </div>

      <div className={styles.sections}>
        <div className={styles.row}>
          <ThemeSection />
          <ReminderSection />
        </div>
        <GamesSection />
        <div className={styles.row}>
          <AccountSection />
          <GoogleSection />
        </div>
      </div>

      <section
        className={styles.deletion}
        aria-labelledby="settings-deletion-heading"
      >
        <h2 id="settings-deletion-heading" className={styles.heading}>
          {copy.deletion.heading}
        </h2>
        <p className={styles.body}>{copy.deletion.lead}</p>
        <Link
          className={styles.textLink}
          href={`${routes.privacy}#${deleteAccountAnchor}`}
        >
          {copy.deletion.link}
        </Link>
      </section>
    </main>
  );
}
