"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";

import {
  archiveDayRoute,
  archiveMonthRoute,
  formatDayNumber,
  formatLongDate,
  formatMonth,
  messages,
} from "../i18n";
import { accentVars } from "../play/accent";
import { ShareButton } from "../play/share-button";
import {
  useRecordSnapshot,
  type RecordSnapshot,
} from "../play/use-record-snapshot";
import styles from "./late-result.module.css";
import { monthOf } from "./parse-params";

function note(snapshot: RecordSnapshot, alreadyConcluded: boolean): string {
  const copy = messages.archive.result;
  if (!snapshot.hydrated || snapshot.record === undefined) {
    return copy.notStored;
  }
  if (snapshot.record.pendingSync) {
    return copy.pending;
  }
  if (snapshot.record.syncOutcome === "rejected") {
    return copy.rejected;
  }
  return alreadyConcluded ? copy.already : copy.late;
}

export function LateResult({
  game,
  date,
  outcome,
  alreadyConcluded,
}: {
  readonly game: Game;
  readonly date: string;

  readonly outcome: "won" | "lost";

  readonly alreadyConcluded: boolean;
}) {
  const copy = messages.archive;

  const snapshot = useRecordSnapshot(game, date);
  const record = snapshot.hydrated ? snapshot.record : undefined;

  const answer = record?.game === "termo" ? record.answer : undefined;

  const stored = record?.concluded === true ? record : undefined;
  const longDate = formatLongDate(date);
  const month = monthOf(date);
  const monthName = formatMonth(`${month}-01`);

  return (
    <main
      className={styles.panel}
      style={accentVars(game)}
      data-play-state="concluded"
    >
      <h1 className={styles.title}>
        {outcome === "won" ? copy.result.wonTitle : copy.result.lostTitle}
      </h1>

      <div aria-hidden className={styles.stamp}>
        <span className={styles.stampLabel}>{copy.result.stampLabel}</span>
        <span className={styles.stampDay}>{formatDayNumber(date)}</span>
        <span className={styles.stampMonth}>{monthName}</span>
      </div>

      <p className={styles.note}>{note(snapshot, alreadyConcluded)}</p>

      {answer === undefined ? null : (
        <div className={styles.wordRow}>
          <p className={styles.wordLead}>{copy.result.wordLead}</p>
          <p className={styles.word}>{answer}</p>
        </div>
      )}

      <ShareButton game={game} date={date} stored={stored} stamp={undefined} />

      <nav className={styles.links}>
        <Link
          className={styles.link}
          href={archiveDayRoute(date)}
          prefetch={false}
          aria-label={copy.backToDayAria(longDate)}
        >
          {copy.backToDay(longDate)}
        </Link>
        <Link
          className={styles.link}
          href={archiveMonthRoute(month)}
          prefetch={false}
          aria-label={copy.backToMonthAria(monthName)}
        >
          {copy.backToMonth(monthName)}
        </Link>
      </nav>
    </main>
  );
}
