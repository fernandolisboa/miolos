import type { Metadata } from "next";

import { messages } from "../../src/i18n";
import { PageTopBar } from "../../src/components/page-top-bar";
import { AttachConfirm } from "./attach-confirm";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: `${messages.confirm.title} — ${messages.brand.wordmark}`,
  robots: { index: false, follow: false },
};

export default async function AttachLandingPage({
  searchParams,
}: {
  readonly searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
} = {}) {
  const params = (await searchParams) ?? {};
  const tokenParam = params["token"];

  const token = typeof tokenParam === "string" ? tokenParam : "";

  return (
    <main className={styles.page} data-page="vincular">
      <PageTopBar />

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{messages.confirm.title}</h1>
      </div>

      <AttachConfirm token={token} />
    </main>
  );
}
