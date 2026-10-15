import Link from "next/link";

import { messages, routes } from "../i18n";
import { Wordmark } from "./brand-mark";
import styles from "./page-top-bar.module.css";

const HOME_BACK = {
  href: routes.home,
  label: messages.play.back,
  ariaLabel: messages.play.backAria,
};

export function PageTopBar({
  back = HOME_BACK,
  kicker,
}: {
  back?: { href: string; label: string; ariaLabel: string };
  kicker?: string;
}) {
  return (
    <header className={styles.topBar}>
      <Link
        className={styles.back}
        href={back.href}
        aria-label={back.ariaLabel}
      >
        {back.label}
      </Link>
      <Wordmark className={styles.wordmark} />
      {kicker === undefined ? null : (
        <span className={styles.kicker}>{kicker}</span>
      )}
    </header>
  );
}
