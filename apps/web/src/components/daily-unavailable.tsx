import Link from "next/link";

import { messages, routes } from "../i18n";
import styles from "./daily-unavailable.module.css";

/**
 * The pt-BR screen for a day with no published puzzle (plan 014 D13):
 * `getTodayDaily` returned `undefined` because nothing is published for
 * the database clock's São Paulo day, or the row was killed. The app never
 * generates on demand and never shows an unpublished board (ADR-0004), so
 * this is the honest answer rather than a fallback puzzle.
 *
 * EXTENSION POINT: #23/#25/#27 pass their own game's copy in; today
 * Binairo is the only daily play route, so the copy is read directly.
 */
export function DailyUnavailable() {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        {/* The tape is decoration with no meaning to announce. */}
        <div aria-hidden className={styles.tape} />
        {/* The <h1> is the FIRST element child on purpose: impeccable's
            hero-eyebrow-chip and kicker-above-heading rules both anchor on
            `h1.previousElementSibling`, and both return early when it is
            null (plan 017 §12.2). Do not add a kicker above it. */}
        <h1 className={styles.title}>{messages.binairo.unavailable.title}</h1>
        <p className={styles.body}>{messages.binairo.unavailable.body}</p>
        <Link className={styles.cta} href={routes.home}>
          {messages.binairo.unavailable.cta}
        </Link>
      </article>
    </main>
  );
}
