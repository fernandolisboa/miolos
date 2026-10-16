"use client";

import { messages } from "../i18n";
import { PictureArt } from "../play/picture-art";
import type { ConclusionPicture } from "../play/types";
import type { Choice } from "./choice";
import styles from "./free-play.module.css";
import { FreePlaySolvedCard } from "./solved-card";

export interface PictureSolvedProps {
  readonly choices: readonly Choice[];
  readonly picture: Omit<ConclusionPicture, "label">;
  readonly onAgain: () => void;
}

export function PictureSolvedCard({
  choices,
  picture,
  onAgain,
}: PictureSolvedProps) {
  return (
    <FreePlaySolvedCard
      game="nonogram"
      choices={choices}
      onAgain={onAgain}
      picture={
        <PictureArt
          picture={{ ...picture, label: messages.freePlay.solved.pictureAria }}
          className={styles.picture}
        />
      }
    />
  );
}
