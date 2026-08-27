import type { Metadata } from "next";
import Link from "next/link";

import { messages, routes } from "../../src/i18n";
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
        <h1 className={styles.title}>{messages.confirm.title}</h1>
      </div>

      <AttachConfirm token={token} />
    </main>
  );
}
