import Link from "next/link";

import { messages, routes } from "../../src/i18n";
import { DeleteAccount } from "./delete-account";
import styles from "./page.module.css";

/**
 * The privacy policy (#21, ADR-0012, ADR-0050 decision 12) — the
 * modo-livre static register: STATIC on purpose, no `dynamic` export, no
 * db import, no fetch in the server component, every string from
 * `messages.privacy.*`. The copy states exactly what this release ships —
 * page and mechanism land in the same PR, so they cannot drift — and the
 * one client component is the self-service deletion island at the end
 * (D13's quiet, ink-styled section).
 */
export default function PrivacyPage() {
  return (
    <main className={styles.page} data-page="privacidade">
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
        <h1 className={styles.title}>{messages.privacy.title}</h1>
        <p className={styles.lead}>{messages.privacy.intro}</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.privacy.collected.heading}</h2>
        <ul className={styles.list}>
          <li>{messages.privacy.collected.account}</li>
          <li>{messages.privacy.collected.email}</li>
          <li>{messages.privacy.collected.telemetry}</li>
          <li>{messages.privacy.collected.medals}</li>
          <li>{messages.privacy.collected.push}</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.privacy.why.heading}</h2>
        <ul className={styles.list}>
          <li>{messages.privacy.why.recovery}</li>
          <li>{messages.privacy.why.reminder}</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.privacy.consents.heading}</h2>
        <p className={styles.body}>{messages.privacy.consents.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.privacy.deletion.heading}</h2>
        <p className={styles.body}>{messages.privacy.deletion.selfService}</p>
        <p className={styles.body}>
          {messages.privacy.deletion.contactLead}{" "}
          <a
            className={styles.contact}
            href={`mailto:${messages.privacy.deletion.contactEmail}`}
          >
            {messages.privacy.deletion.contactEmail}
          </a>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>
          {messages.privacy.noPassword.heading}
        </h2>
        <p className={styles.body}>{messages.privacy.noPassword.body}</p>
        <p className={styles.revision}>{messages.privacy.revision}</p>
      </section>

      <DeleteAccount />
    </main>
  );
}
