"use client";

import Link from "next/link";

import { messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import { picturePath } from "../play/picture-path";
import type { ConclusionPicture } from "../play/types";
import type { FreePlayGame, FreePlayLevel } from "./catalog";
import styles from "./free-play.module.css";

export function FreePlaySolvedCard({
  game,
  level,
  picture,
  word,
  onAgain,
}: {
  readonly game: FreePlayGame;
  readonly level?: FreePlayLevel;
  readonly picture?: ConclusionPicture;
  readonly word?: { readonly canonical: string; readonly won: boolean };
  readonly onAgain: () => void;
}) {
  const lost = word?.won === false;
  const copy = messages.freePlay.solved;

  return (
    <main
      className={styles.solvedPage}
      style={accentVars(game)}
      data-play-state={lost ? "lost" : "solved"}
    >
      <article className={styles.solvedCard}>
        <div aria-hidden className={styles.tape} />
        <p className={styles.stamp}>{lost ? copy.lostStamp : copy.stamp}</p>
        <p className={styles.modeLine}>
          {copy.modeLine(
            messages.freePlay.modeTag,
            messages.games[game].name,
            level === undefined ? undefined : messages.freePlay.level[level],
          )}
        </p>
        {word !== undefined && (
          <p className={styles.wordLine}>
            <span className={styles.wordLead}>{copy.wordLead}</span>
            <span className={styles.word}>{word.canonical}</span>
          </p>
        )}
        {picture !== undefined && (
          <div className={styles.pictureRow}>
            <svg
              className={styles.picture}
              role="img"
              aria-label={picture.label}
              viewBox={`0 0 ${String(picture.size)} ${String(picture.size)}`}
              shapeRendering="crispEdges"
            >
              <path d={picturePath(picture)} />
            </svg>
          </div>
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
    </main>
  );
}
