import type { Metadata } from "next";

import { PageTopBar } from "../../src/components/page-top-bar";
import { messages } from "../../src/i18n";
import settings from "../ajustes/page.module.css";
import { AdminConfigSection } from "./admin-config-section";
import styles from "./admin.module.css";

export const metadata: Metadata = {
  title: `${messages.admin.title} — ${messages.brand.wordmark}`,
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const copy = messages.admin;
  return (
    <main className={settings.page} data-page="admin">
      <PageTopBar />

      <div className={settings.titleBlock}>
        <h1 className={settings.title}>{copy.title}</h1>
        <p className={settings.lead}>{copy.lead}</p>
      </div>

      <div className={`${settings.sections} ${styles.sections}`}>
        <AdminConfigSection />
      </div>
    </main>
  );
}
