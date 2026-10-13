import type { Metadata } from "next";

import { PageTopBar } from "../../src/components/page-top-bar";
import { messages } from "../../src/i18n";
import styles from "../ajustes/page.module.css";
import { AdminConfigSection } from "./admin-config-section";

export const metadata: Metadata = {
  title: `${messages.admin.title} — ${messages.brand.wordmark}`,
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const copy = messages.admin;
  return (
    <main className={styles.page} data-page="admin">
      <PageTopBar />

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
      </div>

      <AdminConfigSection />
    </main>
  );
}
