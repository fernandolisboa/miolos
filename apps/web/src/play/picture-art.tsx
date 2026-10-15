"use client";

import { useContext } from "react";

import { useSettings } from "../settings/settings";
import { JustEnded } from "./just-ended";
import styles from "./picture-art.module.css";
import { pictureOutline, picturePath } from "./picture-path";
import type { ConclusionPicture } from "./types";

export function PictureArt({
  picture,
  className,
}: {
  readonly picture: ConclusionPicture;
  readonly className: string | undefined;
}) {
  const { size, cells, tones } = picture;
  const justEnded = useContext(JustEnded);
  const { endAnimation } = useSettings();
  const painted = tones !== undefined && fits(tones, cells) ? tones : undefined;

  return (
    <svg
      className={className}
      role="img"
      aria-label={picture.label}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      shapeRendering="crispEdges"
    >
      <path d={picturePath(size, cells)} />
      {painted !== undefined && (
        <g
          className={
            justEnded && endAnimation
              ? `${styles.tones} ${styles.wipe}`
              : styles.tones
          }
          data-toned=""
        >
          {[...new Set(painted.replaceAll(".", ""))].map((tone) => (
            <path
              key={tone}
              d={picturePath(size, painted, tone)}
              style={{ fill: `var(--tone-${tone})` }}
            />
          ))}
          <path
            className={styles.outline}
            d={pictureOutline(size, cells)}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </svg>
  );
}

function fits(tones: string, cells: readonly (0 | 1)[]): boolean {
  return (
    tones.length === cells.length &&
    cells.every((cell, index) => (cell === 0) === (tones[index] === "."))
  );
}
