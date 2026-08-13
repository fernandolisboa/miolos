"use client";

/**
 * The free-play solved card (#28, plan 025 §7.3): an in-place swap when the
 * board closes — no navigation, so finishing offline works, exactly the
 * daily's trick. A paper card in the game's accent: the "Resolvido!" stamp,
 * the Nonogram's painted picture where applicable (its curated name is
 * withheld EVERYWHERE — ADR-0033 as amended by ADR-0047), then "Mais um",
 * back to the index, and a quiet link to Hoje.
 *
 * No elapsed time (ADR-0046 decision 6: free play has no timer) and no
 * completion language: **Conclusão** is a daily verb (CONTEXT.md) and
 * nothing here was recorded anywhere (ADR-0008 rule 5).
 */
import Link from "next/link";

import { messages, routes } from "../i18n";
import { accentVars } from "../play/accent";
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
  /** The painted payoff — Nonogram only; never a motif name or id. */
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
          {messages.freePlay.modeTag} · {messages.games[game].name} ·{" "}
          {messages.freePlay.level[level]}
        </p>
        {picture !== undefined && (
          // One <svg>, one <path> — the conclusion's own pattern (SVG, Skia
          // or code inside the app; CLAUDE.md). The path builder is a local
          // copy: `conclusion-view.tsx` owns the original and sits behind
          // the free-play import wall by design (plan 025 §6.5).
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

/** One `M…h1v1h-1z` square per filled cell, in row-major order. */
function picturePath(picture: ConclusionPicture): string {
  let path = "";
  for (const [index, cell] of picture.cells.entries()) {
    if (cell === 1) {
      const row = Math.floor(index / picture.size);
      const column = index % picture.size;
      path += `M${String(column)} ${String(row)}h1v1h-1z`;
    }
  }
  return path;
}
