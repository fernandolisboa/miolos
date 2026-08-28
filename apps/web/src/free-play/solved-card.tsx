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
  onAgain,
}: {
  readonly game: FreePlayGame;
  readonly level: FreePlayLevel;

  readonly picture?: ConclusionPicture;
  readonly onAgain: () => void;
}) {
  return (
    <main
      className={styles.solvedPage}
      style={accentVars(game)}
      data-play-state="solved"
    >
      <article className={styles.solvedCard}>
        <div aria-hidden className={styles.tape} />
        <p className={styles.stamp}>{messages.freePlay.solved.stamp}</p>
        <p className={styles.modeLine}>
          {messages.freePlay.solved.modeLine(
            messages.freePlay.modeTag,
            messages.games[game].name,
            messages.freePlay.level[level],
          )}
        </p>
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
            {messages.freePlay.solved.again}
          </button>
          <Link
            className={styles.backToIndex}
            href={routes.freePlay}
            aria-label={messages.freePlay.backToIndexAria}
          >
            {messages.freePlay.solved.backToIndex}
          </Link>
          <Link className={styles.quietLink} href={routes.home}>
            {messages.freePlay.solved.backHome}
          </Link>
        </div>
      </article>
    </main>
  );
}
