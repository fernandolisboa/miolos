"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
import { EndingFlourish } from "../play/ending-flourish";
import { JustEnded } from "../play/just-ended";
import { picturePath } from "../play/picture-path";
import type { ConclusionPicture } from "../play/types";
import type { FreePlayGame } from "./catalog";
import type { FreePlayChoice } from "./choice-picker";
import styles from "./free-play.module.css";

export function FreePlaySolvedCard<T extends string | number>({
  game,
  choice,
  picture,
  word,
  onAgain,
  children,
}: {
  readonly game: FreePlayGame;
  readonly choice?: FreePlayChoice<T>;
  readonly picture?: ConclusionPicture;
  readonly word?: { readonly canonical: string; readonly won: boolean };
  readonly onAgain: () => void;
  readonly children?: ReactNode;
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
        <div className={styles.stampSlot}>
          <JustEnded value>
            <EndingFlourish outcome={lost ? "lost" : "won"}>
              <p className={styles.stamp}>
                {lost ? copy.lostStamp : copy.stamp}
              </p>
            </EndingFlourish>
          </JustEnded>
        </div>
        <p className={styles.modeLine}>
          {copy.modeLine(
            messages.freePlay.modeTag,
            messages.games[game].name,
            choice?.optionLabel(choice.value),
          )}
        </p>
        {children !== undefined && (
          <div className={styles.boardRow}>{children}</div>
        )}
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
