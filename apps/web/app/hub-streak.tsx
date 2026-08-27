"use client";

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
