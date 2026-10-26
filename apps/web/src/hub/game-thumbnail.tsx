import type { ReactNode } from "react";

import type { Game } from "@miolos/core";

import { accentVars } from "../play/accent";
import styles from "./game-thumbnail.module.css";
import {
  THUMBNAILS,
  type CellKind,
  type Mark,
  type ThumbnailCell,
} from "./thumbnails";

const CELL = 10;
const MARGIN = 2;

const DRAWN: Partial<Record<CellKind, ReactNode>> = {
  absent: <path className={styles.strike} d="M2 5H8" />,
  present: <path className={styles.underline} d="M2.5 8.7H7.5" />,
  cover: (
    <>
      <path className={styles.bevelLight} d="M.4 9.6V.4h9.2" />
      <path className={styles.bevelDark} d="M0 9.4h9.4V0" />
    </>
  ),
};

const MARKS: Record<Mark, ReactNode> = {
  crown: (
    <svg
      className={styles.crown}
      x="2"
      y="2"
      width="6"
      height="6"
      viewBox="0 0 24 24"
    >
      <path d="M4 18 2.5 8l5 4L12 4l4.5 8 5-4L20 18Z" />
      <rect x="4" y="19.5" width="16" height="2.5" rx="1" />
    </svg>
  ),
  flag: (
    <svg x="1.4" y="1.4" width="7.2" height="7.2" viewBox="0 0 24 24">
      <path className={styles.pole} d="M8 4v16M5 20h8" />
      <path className={styles.pennant} d="M8 4l10 4.5L8 13z" />
    </svg>
  ),
};

function isRegion(kind: CellKind | undefined): boolean {
  return kind?.startsWith("region") ?? false;
}

function regionBoundaries(
  cells: readonly ThumbnailCell[],
  columns: number,
  pitch: number,
): string {
  const half = (pitch - CELL) / 2;
  return cells
    .flatMap((cell, index) => {
      if (!isRegion(cell.kind)) {
        return [];
      }
      const x = (index % columns) * pitch;
      const y = Math.floor(index / columns) * pitch;
      const right =
        index % columns < columns - 1 ? cells[index + 1] : undefined;
      const below = cells[index + columns];
      return [
        isRegion(right?.kind) && right?.kind !== cell.kind
          ? `M${String(x + CELL + half)} ${String(y - half)}v${String(pitch)}`
          : "",
        isRegion(below?.kind) && below?.kind !== cell.kind
          ? `M${String(x - half)} ${String(y + CELL + half)}h${String(pitch)}`
          : "",
      ];
    })
    .join("");
}

function Cell({
  cell,
  x,
  y,
  radius,
}: {
  readonly cell: ThumbnailCell;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}) {
  return (
    <g
      className={styles[cell.kind]}
      transform={`translate(${String(x)} ${String(y)})`}
    >
      <rect className={styles.tile} width={CELL} height={CELL} rx={radius} />
      {cell.glyph !== undefined && (
        <text
          className={/\d/.test(cell.glyph) ? styles.numeral : styles.letter}
          x={CELL / 2}
          y={CELL / 2}
        >
          {cell.glyph}
        </text>
      )}
      {DRAWN[cell.kind]}
      {cell.mark !== undefined && MARKS[cell.mark]}
    </g>
  );
}

export function GameThumbnail({ game }: { readonly game: Game }) {
  const { columns, tilt, outlined, ruled, cells } = THUMBNAILS[game];
  const gap = ruled ? 1 : 2;
  const pitch = CELL + gap;
  const width = columns * pitch - gap;
  const height = (cells.length / columns) * pitch - gap;
  const boundaries = regionBoundaries(cells, columns, pitch);

  return (
    <span
      aria-hidden
      className={styles.frame}
      style={{ ...accentVars(game), rotate: `${String(tilt)}deg` }}
    >
      <svg
        className={styles.board}
        viewBox={`${String(-MARGIN)} ${String(-MARGIN)} ${String(width + 2 * MARGIN)} ${String(height + 2 * MARGIN)}`}
      >
        {ruled && (
          <rect className={styles.rules} width={width} height={height} />
        )}
        {cells.map((cell, index) => (
          <Cell
            key={index}
            cell={cell}
            x={(index % columns) * pitch}
            y={Math.floor(index / columns) * pitch}
            radius={ruled ? 0 : 1.5}
          />
        ))}
        {boundaries !== "" && (
          <path className={styles.boundary} d={boundaries} />
        )}
        {outlined && (
          <rect
            className={styles.outline}
            x="-1"
            y="-1"
            width={width + 2}
            height={height + 2}
            rx="2"
          />
        )}
      </svg>
    </span>
  );
}
