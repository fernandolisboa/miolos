"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import { EndingFlourish } from "../play/ending-flourish";
import { JustEnded } from "../play/just-ended";
import type { FreePlayGame } from "./catalog";
import styles from "./free-play.module.css";

export function FreePlaySolvedCard({
  game,
  variant,
  level,
  picture,
  words,
  lost = false,
  onAgain,
  children,
}: {
  readonly game: FreePlayGame;
  readonly variant?: string;
  readonly level?: string;
  readonly picture?: ReactNode;
  readonly words?: readonly string[];
  readonly lost?: boolean;
  readonly onAgain: () => void;
  readonly children?: ReactNode;
}) {
  const copy = messages.freePlay.solved;

  return (
    <main
      className={styles.solvedPage}
      style={accentVars(game)}
      data-play-state={lost ? "lost" : "solved"}
    >
      <JustEnded value>
        <article className={styles.solvedCard}>
          <div aria-hidden className={styles.tape} />
          <div className={styles.stampSlot}>
            <EndingFlourish outcome={lost ? "lost" : "won"}>
              <p className={styles.stamp}>
                {lost ? copy.lostStamp : copy.stamp}
              </p>
            </EndingFlourish>
          </div>
          <p className={styles.modeLine}>
            {copy.modeLine(
              messages.freePlay.modeTag,
              messages.games[game].name,
              variant,
              level,
            )}
          </p>
          {children !== undefined && (
            <div className={styles.boardRow}>{children}</div>
          )}
          {words !== undefined && (
            <p className={styles.wordLine}>
              <span className={styles.wordLead}>
                {words.length === 1 ? copy.wordLead : copy.wordsLead}
              </span>
              {words.map((word) => (
                <span key={word} className={styles.word}>
                  {word}
                </span>
              ))}
            </p>
          )}
          {picture !== undefined && (
            <div className={styles.pictureRow}>{picture}</div>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.again} onClick={onAgain}>
              {copy.again[game]}
            </button>
            <Link
              className={styles.backToIndex}
              href={routes.freePlay}
              aria-label={messages.freePlay.backToIndexAria}
            >
              {copy.backToIndex}
            </Link>
            <Link className={styles.quietLink} href={routes.home}>
              {copy.backHome}
            </Link>
          </div>
        </article>
      </JustEnded>
    </main>
  );
}
