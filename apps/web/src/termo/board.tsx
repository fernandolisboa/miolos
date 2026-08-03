import { MAX_GUESSES, WORD_LENGTH, type TileState } from "@miolos/games/termo";
import { memo } from "react";

import { messages } from "../i18n";
import styles from "./termo-board.module.css";
import type { TermoJudgedRow } from "./types";

/**
 * The tile board (#27, plan 022 §12.2/§13.2, ADR-0042 decision 1).
 *
 * READ-ONLY OUTPUT. Nothing here is focusable, nothing here takes a pointer
 * event, and there is no caret to rove: a Termo board has no selectable cell,
 * which is why ADR-0030's composite-widget model — scoped to GRID games —
 * does not reach it. The whole input surface is the keyboard beside it.
 *
 * Not `role="grid"`, and the argument is stronger here than for Sudoku: a
 * grid promises keyboard navigation over cells, and these cells are not
 * navigable at all. A labelled `role="group"` of six labelled `role="group"`
 * rows is the honest shape.
 *
 * THE ROW'S COMPOSED NAME IS THE ROW'S ONLY ACCESSIBLE CONTENT, because every
 * tile is `aria-hidden`. Unhidden tiles make a screen reader read the word
 * twice, the second time ungraded — the same defect as five one-letter spans
 * concatenating to "CAFES" with no states (ADR-0037 decision 3's "22223").
 * That makes the name load-bearing on the ACTIVE row too, not only on judged
 * ones: `rowActiveAria` carries the draft letters, and `.announcer` carries
 * every keystroke, or a screen-reader user has no signal whatsoever between
 * the first keypress and `enviar`.
 */
const copy = messages.games.termo.play;

/** Six real row boxes and five tiles each — never `display: contents`. */
const ROW_INDEXES: readonly number[] = Array.from(
  { length: MAX_GUESSES },
  (_unused, row) => row,
);

const SLOT_INDEXES: readonly number[] = Array.from(
  { length: WORD_LENGTH },
  (_unused, slot) => slot,
);

/**
 * The three judged appearances, as a spelled-out map rather than a class name
 * assembled from a state string: a computed index would typecheck while
 * silently resolving to nothing after a rename.
 *
 * `satisfies … | undefined` rather than an annotation, because Next types a
 * CSS Module's default export as `{readonly [key: string]: string}` and
 * `noUncheckedIndexedAccess` therefore makes every local `string | undefined`
 * — `nonogram/board.tsx:50-55`'s shipped `SIZE_CLASS` carries the identical
 * shape for the identical reason.
 */
const TILE_STATE_CLASS = {
  correct: styles.tileCorrect,
  present: styles.tilePresent,
  absent: styles.tileAbsent,
} satisfies Record<TileState, string | undefined>;

export interface BoardProps {
  /** Judged rows only, oldest first. */
  readonly guesses: readonly TermoJudgedRow[];
  /** The row the player is writing into, or null. */
  readonly activeRow: number | null;
  /** The row holding a submitted, unjudged guess, or null. */
  readonly heldRow: number | null;
  readonly draft: string;
  readonly pending: string | null;
}

/**
 * MEMOIZED, and it is a real defect fix rather than a precaution (finding
 * B-4, the #25 precedent at `nonogram/board.tsx:121`). `usePlayLifecycle`
 * runs `setInterval(() => dispatch({type:"tick", now: Date.now()}), 1000)`
 * for the whole live game, and ADR-0045 decision 4 removed the only thing
 * that tick exists to repaint — `/termo` renders no clock at all. So a player
 * who thinks for five minutes fires 300 ticks, and without this each one
 * re-rendered all 30 tiles: 6 row-aria compositions + 30 `tileClassName` /
 * `letterAt` pairs, for ZERO DOM writes. ~10 200 wasted aria compositions
 * over that game.
 *
 * The default shallow compare is exactly right and needs nothing else: the
 * `tick` case spreads `...state`, so `guesses` keeps its array identity, and
 * `activeRow`, `heldRow`, `draft` and `pending` are all primitives or null.
 * Adding a prop that is rebuilt per render silently undoes it — the same
 * warning `nonogram/board.tsx` carries.
 *
 * Measured with `T-WEB-S104`: 0 row-label compositions across ten timer
 * ticks, proved red at 5 with the memo removed (jsdom batches the ten fake
 * intervals into one commit, so 5 is one whole board repaint — in a browser
 * the same ten seconds are ten).
 */
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
            // FOUR cases, not three: a HELD row is neither empty nor judged,
            // and it is the only row a player can be looking at while nothing
            // moves (ADR-0039 consequence (g)).
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
              // aria-hidden: the row's name already carries every letter AND
              // its verdict, so an unhidden tile is the word read twice.
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

/**
 * The pre-hydration board (plan 022 §13.3). Thirty tiles at final size, so the
 * card's box is the shipped one before the record has been read — `.board` is
 * a centred flex column and a missing row hands its height to the board as an
 * offset. Divs with no role and no name, on `keypad.tsx:62-71`'s rule: nothing
 * here is focusable or announced before it works.
 */
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

/**
 * One tile's classes. `.tileJudged` rides ALONGSIDE the state class rather
 * than inside it, because it is what carries the 60ms-per-column reveal
 * stagger and only a JUDGED tile may pick that up — `transition-delay` is
 * read from the destination state's computed style, so a tile becoming
 * `typed` must not carry one.
 */
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
  // The caret is the next EMPTY slot of the active row, and it is a pure
  // state class: nothing on this board is focusable, so `:focus-visible`
  // could never match.
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
