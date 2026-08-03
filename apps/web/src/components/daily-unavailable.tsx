import Link from "next/link";

import { routes } from "../i18n";
import styles from "./daily-unavailable.module.css";

/**
 * The copy this screen renders. Structural rather than
 * `Messages["games"]["binairo"]["play"]["unavailable"]`: every game's block
 * has the same three keys (plan 018 §13.2) and pinning the type to one of
 * them would make the prop game-specific again.
 */
export interface DailyUnavailableCopy {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
}

/**
 * The pt-BR screen for a day with no published puzzle (plan 014 D13):
 * `getTodayDaily` returned `undefined` because nothing is published for
 * the database clock's São Paulo day, or the row was killed. The app never
 * generates on demand and never shows an unpublished board (ADR-0004), so
 * this is the honest answer rather than a fallback puzzle.
 *
 * The copy arrives as a prop (plan 018 §13.3): #23 made Sudoku the second
 * daily play route, so the screen can no longer read one game's block
 * directly. All four games pass their own since #27 — `nonogram-screen.tsx`,
 * `termo-screen.tsx` and both page shells of every route.
 */
export function DailyUnavailable({
  copy,
}: {
  readonly copy: DailyUnavailableCopy;
}) {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        {/* The tape is decoration with no meaning to announce. */}
        <div aria-hidden className={styles.tape} />
        {/* Nothing with TEXT may precede the <h1>: impeccable's
            hero-eyebrow-chip and kicker-above-heading rules both anchor on
            `h1.previousElementSibling` and classify it by its content, so a
            short line above the title reads as an unstyled eyebrow (plan 017
            §12.2). The tape above is not null — it is the previous sibling —
            but it is an empty decorative div with no text, which is why
            neither rule fires; the scan is green at 1440 and 390. Do not add
            a kicker above the title, and do not put copy in the tape. */}
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.body}>{copy.body}</p>
        <Link className={styles.cta} href={routes.home}>
          {copy.cta}
        </Link>
      </article>
    </main>
  );
}
