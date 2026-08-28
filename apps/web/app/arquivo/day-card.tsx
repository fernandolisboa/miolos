"use client";

import type { Game } from "@miolos/core";
import Link from "next/link";

import { archiveCardStatus } from "../../src/archive/card-status";
import { accentVars } from "../../src/play/accent";
import { useRecordSnapshot } from "../../src/play/use-record-snapshot";
import styles from "./arquivo.module.css";

interface ArchiveDayCardProps {
  readonly game: Game;
  readonly date: string;
  readonly index: number;
  readonly name: string;
  readonly kicker: string;
  readonly href: string;
  readonly cardAria: string;
  readonly cardAriaDone: string;
  readonly cardAriaPlayed: string;
  readonly done: string;
  readonly played: string;
}

export function ArchiveDayCard({
  game,
  date,
  index,
  name,
  kicker,
  href,
  cardAria,
  cardAriaDone,
  cardAriaPlayed,
  done,
  played,
}: ArchiveDayCardProps) {
  const snapshot = useRecordSnapshot(game, date);

  const status = snapshot.hydrated
    ? archiveCardStatus(snapshot.record)
    : "pending";

  const chip =
    status === "completed" ? done : status === "played" ? played : undefined;
  const label =
    status === "completed"
      ? cardAriaDone
      : status === "played"
        ? cardAriaPlayed
        : cardAria;

  return (
    <Link
      className={`${styles.card} ${
        index % 2 === 0 ? styles.cardOdd : styles.cardEven
      }`}
      style={accentVars(game)}
      href={href}
      prefetch={false}
      aria-label={label}
    >
      <span aria-hidden className={styles.tape} />
      <div className={styles.cardTop}>
        <p className={styles.cardKicker}>{kicker}</p>
        {chip !== undefined && (
          <span aria-hidden className={styles.doneChip}>
            {chip}
          </span>
        )}
      </div>
      <p className={styles.cardTitle}>{name}</p>
    </Link>
  );
}
