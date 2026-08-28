import Link from "next/link";

import { routes } from "../i18n";
import styles from "./daily-unavailable.module.css";

export interface DailyUnavailableCopy {
  readonly title: string;
  readonly body: string;
  readonly cta: string;
}

export function DailyUnavailable({
  copy,
}: {
  readonly copy: DailyUnavailableCopy;
}) {
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <div aria-hidden className={styles.tape} />

        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.body}>{copy.body}</p>
        <Link className={styles.cta} href={routes.home}>
          {copy.cta}
        </Link>
      </article>
    </main>
  );
}
