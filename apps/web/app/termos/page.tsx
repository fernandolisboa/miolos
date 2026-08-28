import Link from "next/link";

import { messages, routes } from "../../src/i18n";
import styles from "./page.module.css";

export default function TermsPage() {
  return (
    <main className={styles.page} data-page="termos">
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
        <h1 className={styles.title}>{messages.terms.title}</h1>
        <p className={styles.lead}>{messages.terms.intro}</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.terms.free.heading}</h2>
        <p className={styles.body}>{messages.terms.free.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.terms.account.heading}</h2>
        <p className={styles.body}>{messages.terms.account.body}</p>
        <p className={styles.body}>
          {messages.terms.account.privacyLead}{" "}
          <Link className={styles.contact} href={routes.privacy}>
            {messages.terms.account.privacyLinkLabel}
          </Link>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>
          {messages.terms.acceptableUse.heading}
        </h2>
        <p className={styles.body}>{messages.terms.acceptableUse.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.terms.content.heading}</h2>
        <p className={styles.body}>{messages.terms.content.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.terms.warranty.heading}</h2>
        <p className={styles.body}>{messages.terms.warranty.asIs}</p>
        <p className={styles.body}>{messages.terms.warranty.liability}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.terms.changes.heading}</h2>
        <p className={styles.body}>{messages.terms.changes.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>{messages.terms.contact.heading}</h2>
        <p className={styles.body}>
          {messages.terms.contact.lead}{" "}
          <a
            className={styles.contact}
            href={`mailto:${messages.terms.contact.email}`}
          >
            {messages.terms.contact.email}
          </a>
          .
        </p>
        <p className={styles.revision}>{messages.terms.revision}</p>
      </section>
    </main>
  );
}
