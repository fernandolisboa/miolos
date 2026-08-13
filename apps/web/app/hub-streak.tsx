"use client";

/**
 * The hub's streak stamp, live since #19 (ADR-0048): the third client
 * fragment beside `hub-day-state.tsx`'s two, here for the same mechanical
 * reason — CSS Modules hash per file, and this stamp paints with
 * `page.module.css`'s own `.streakStamp` classes.
 *
 * The server render and the pre-hydration paint show 0 — the honest
 * unknown of a value only the server can compute — and hydration only ever
 * RAISES the number (the monotone direction, ADR-0031 decision 2). The
 * fetch fires in a mount effect only: no clock, no storage, no fetch at
 * render, which is what keeps the hub's first-paint contract (T-WEB-S17 /
 * T-WEB-S127) true. `impeccable detect` scans a clean profile and
 * therefore always sees this zero-state composition — a legitimate design,
 * already pinned.
 */
import { messages } from "../src/i18n";
import { useStreak } from "../src/streak/use-streak";
import styles from "./page.module.css";

export function HubStreak() {
  const streakCount = useStreak()?.streak ?? 0;
  return (
    <div
      className={styles.streakStamp}
      aria-label={messages.hoje.streak.aria(streakCount)}
    >
      <div aria-hidden className={`${styles.streakNumeral} tabular-nums`}>
        {streakCount}
      </div>
      <div aria-hidden className={styles.streakLabel}>
        {messages.hoje.streak.label}
      </div>
    </div>
  );
}
