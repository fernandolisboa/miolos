import type { Metadata } from "next";
import Link from "next/link";

import { messages, routes } from "../../src/i18n";
import { AttachConfirm } from "./attach-confirm";
import styles from "./page.module.css";

/**
 * The magic-link landing page (#21, ADR-0050 decision 3) — the modo-livre
 * register MINUS static rendering: awaiting `searchParams` makes the route
 * request-rendered by construction, and everything else holds — no db
 * import, no fetch in the server component, messages-only, marker attr.
 *
 * The GET renders an INERT shell: email scanners and link prefetchers
 * issue GETs, and a GET here consumes nothing. The one explicit button in
 * the island below is what POSTs the token to the api — the human click
 * spends it. `noindex`: a single-use token URL has no business in any
 * index.
 */
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
  // The island receives a plain STRING (serializable props only,
  // T-WEB-S139); anything but a single string value is treated as missing.
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
