import { MAX_GUESSES, WORD_LENGTH, type TileState } from "@miolos/games/termo";
import { memo } from "react";

import { messages } from "../i18n";
import styles from "./termo-board.module.css";
import type { TermoJudgedRow } from "./types";

const copy = messages.games.termo.play;

const ROW_INDEXES: readonly number[] = Array.from(
  { length: MAX_GUESSES },
  (_unused, row) => row,
);

const SLOT_INDEXES: readonly number[] = Array.from(
  { length: WORD_LENGTH },
  (_unused, slot) => slot,
);

const TILE_STATE_CLASS = {
  correct: styles.tileCorrect,
  present: styles.tilePresent,
  absent: styles.tileAbsent,
} satisfies Record<TileState, string | undefined>;

export interface BoardProps {
  readonly guesses: readonly TermoJudgedRow[];

  readonly activeRow: number | null;

  readonly heldRow: number | null;
  readonly draft: string;
  readonly pending: string | null;
}

export const Board = memo(function Board({
  guesses,
  activeRow,
  heldRow,
  draft,
  pending,
}: BoardProps) {
  return (
    <div className={styles.grid} role="group" aria-label={copy.boardAria}>
      {ROW_INDEXES.map((row) => {
        const judged = guesses[row];
        const held = row === heldRow && pending !== null ? pending : null;
        const active =
          judged === undefined && held === null && row === activeRow;
        return (
          <div
            key={row}
            className={styles.row}
            role="group"

            aria-label={
              judged !== undefined
                ? copy.rowAria(row + 1, MAX_GUESSES, judged.guess, judged.tiles)
                : held !== null
                  ? copy.rowHeldAria(row + 1, MAX_GUESSES, held)
                  : active
                    ? copy.rowActiveAria(row + 1, MAX_GUESSES, draft)
                    : copy.rowEmptyAria(row + 1, MAX_GUESSES)
            }
          >
            {SLOT_INDEXES.map((slot) => (
              <div
                key={slot}
                aria-hidden
                className={tileClassName(judged, held, active, draft, slot)}
              >
                {letterAt(judged, held, active, draft, slot)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
});

export function BoardSkeleton() {
  return (
    <div aria-hidden className={styles.grid}>
      {ROW_INDEXES.map((row) => (
        <div key={row} className={styles.row}>
          {SLOT_INDEXES.map((slot) => (
            <div
              key={slot}
              className={`${styles.tile} ${styles.tileSkeleton}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function tileClassName(
  judged: TermoJudgedRow | undefined,
  held: string | null,
  active: boolean,
  draft: string,
  slot: number,
): string | undefined {
  if (judged !== undefined) {
    const tile = judged.tiles[slot];
    return tile === undefined
      ? styles.tile
      : `${styles.tile} ${styles.tileJudged} ${TILE_STATE_CLASS[tile]}`;
  }
  if (held !== null) {
    return `${styles.tile} ${styles.tileHeld}`;
  }
  if (!active) {
    return styles.tile;
  }
  if (slot < draft.length) {
    return `${styles.tile} ${styles.tileTyped}`;
  }

  return slot === draft.length
    ? `${styles.tile} ${styles.tileCaret}`
    : styles.tile;
}

function letterAt(
  judged: TermoJudgedRow | undefined,
  held: string | null,
  active: boolean,
  draft: string,
  slot: number,
): string {
  if (judged !== undefined) {
    return judged.guess.charAt(slot);
  }
  if (held !== null) {
    return held.charAt(slot);
  }
  return active ? draft.charAt(slot) : "";
}
