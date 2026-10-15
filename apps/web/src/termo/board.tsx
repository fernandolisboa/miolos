import { MAX_GUESSES, WORD_LENGTH, type TileState } from "@miolos/games/termo";
import {
  memo,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { messages } from "../i18n";
import { isShortcut } from "../play/grid-selection";
import styles from "./termo-board.module.css";
import type { TermoJudgedRow } from "./types";

const copy = messages.games.termo.play;

const rowIndexes = (rows: number): readonly number[] =>
  Array.from({ length: rows }, (_unused, row) => row);

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
  readonly draft: readonly string[];
  readonly cursor: number;
  readonly pending: string | null;
  readonly onSelect: (slot: number) => void;
  readonly onKey: (key: string) => boolean;
  readonly maxGuesses?: number;
  readonly label?: string;
  readonly draftEditable?: boolean;
  readonly refocusRef?: RefObject<boolean>;
}

export const Board = memo(function Board({
  guesses,
  activeRow,
  heldRow,
  draft,
  cursor,
  pending,
  onSelect,
  onKey,
  maxGuesses = MAX_GUESSES,
  label = copy.boardAria,
  draftEditable = true,
  refocusRef,
}: BoardProps) {
  const ownRefocusRef = useRef(false);
  return (
    <div className={styles.grid} role="group" aria-label={label}>
      {rowIndexes(maxGuesses).map((row) => {
        const judged = guesses[row];
        const held = row === heldRow && pending !== null ? pending : null;
        if (judged === undefined && held === null && row === activeRow) {
          return draftEditable ? (
            <ActiveRow
              key={row}
              row={row}
              draft={draft}
              cursor={cursor}
              maxGuesses={maxGuesses}
              refocusRef={refocusRef ?? ownRefocusRef}
              onSelect={onSelect}
              onKey={onKey}
            />
          ) : (
            <MirrorRow
              key={row}
              row={row}
              draft={draft}
              maxGuesses={maxGuesses}
            />
          );
        }
        return (
          <div
            key={row}
            className={styles.row}
            role="group"
            aria-label={
              judged !== undefined
                ? copy.rowAria(row + 1, maxGuesses, judged.guess, judged.tiles)
                : held !== null
                  ? copy.rowHeldAria(row + 1, maxGuesses, held)
                  : copy.rowEmptyAria(row + 1, maxGuesses)
            }
          >
            {SLOT_INDEXES.map((slot) => (
              <div
                key={slot}
                aria-hidden
                className={tileClassName(judged, held, slot)}
                data-cell-index={row * WORD_LENGTH + slot}
                data-wave-origin={
                  (row === guesses.length - 1 && slot === WORD_LENGTH - 1) ||
                  undefined
                }
              >
                {letterAt(judged, held, slot)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
});

function ActiveRow({
  row,
  draft,
  cursor,
  maxGuesses,
  refocusRef,
  onSelect,
  onKey,
}: {
  readonly row: number;
  readonly draft: readonly string[];
  readonly cursor: number;
  readonly maxGuesses: number;
  readonly refocusRef: RefObject<boolean>;
  readonly onSelect: (slot: number) => void;
  readonly onKey: (key: string) => boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = rowRef.current;
    const refocus = refocusRef.current;
    refocusRef.current = false;
    const focusLost =
      document.activeElement === null ||
      document.activeElement === document.body;
    if (
      element !== null &&
      (element.contains(document.activeElement) || (refocus && focusLost))
    ) {
      element
        .querySelector<HTMLButtonElement>('[tabindex="0"]')
        ?.focus({ preventScroll: true });
    }
  }, [cursor, refocusRef]);

  // A submit unmounts this row and drops its focus on <body>; the next
  // editable row (or this one, after a refusal) takes it back on mount.
  useLayoutEffect(() => {
    const element = rowRef.current;
    return () => {
      refocusRef.current = element?.contains(document.activeElement) ?? false;
    };
  }, [refocusRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isShortcut(event) && onKey(event.key)) {
      event.preventDefault();
    }
  };

  return (
    <div
      ref={rowRef}
      className={styles.row}
      role="group"
      aria-label={copy.rowActiveAria(row + 1, maxGuesses)}
      onKeyDown={onKeyDown}
    >
      {SLOT_INDEXES.map((slot) => {
        const letter = draft[slot] ?? "";
        return (
          <button
            key={slot}
            type="button"
            tabIndex={slot === cursor ? 0 : -1}
            aria-label={copy.cellAria(slot + 1, WORD_LENGTH, letter)}
            className={editableClassName(letter, slot === cursor)}
            onClick={(event) => {
              event.currentTarget.focus();
              onSelect(slot);
            }}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}

function MirrorRow({
  row,
  draft,
  maxGuesses,
}: {
  readonly row: number;
  readonly draft: readonly string[];
  readonly maxGuesses: number;
}) {
  return (
    <div
      className={styles.row}
      role="group"
      aria-label={copy.rowActiveAria(row + 1, maxGuesses)}
    >
      {SLOT_INDEXES.map((slot) => {
        const letter = draft[slot] ?? "";
        return (
          <div
            key={slot}
            aria-hidden
            className={
              letter === "" ? styles.tile : `${styles.tile} ${styles.tileTyped}`
            }
          >
            {letter}
          </div>
        );
      })}
    </div>
  );
}

const NO_DRAFT: readonly string[] = [];

const ignoreSelect = (): void => undefined;

const ignoreKey = (): boolean => false;

export function FinishedBoard({
  guesses,
  maxGuesses,
  label,
}: {
  readonly guesses: readonly TermoJudgedRow[];
  readonly maxGuesses?: number;
  readonly label?: string;
}) {
  return (
    <Board
      guesses={guesses}
      maxGuesses={maxGuesses}
      label={label}
      activeRow={null}
      heldRow={null}
      draft={NO_DRAFT}
      cursor={0}
      pending={null}
      onSelect={ignoreSelect}
      onKey={ignoreKey}
    />
  );
}

export function BoardSkeleton() {
  return (
    <div aria-hidden className={styles.grid}>
      {rowIndexes(MAX_GUESSES).map((row) => (
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
  slot: number,
): string | undefined {
  if (judged !== undefined) {
    const tile = judged.tiles[slot];
    return tile === undefined
      ? styles.tile
      : `${styles.tile} ${styles.tileJudged} ${TILE_STATE_CLASS[tile]}`;
  }
  return held === null ? styles.tile : `${styles.tile} ${styles.tileHeld}`;
}

function editableClassName(letter: string, caret: boolean): string {
  const typed = letter === "" ? "" : ` ${styles.tileTyped ?? ""}`;
  const caretClass = caret ? ` ${styles.tileCaret ?? ""}` : "";
  return `${styles.tile ?? ""} ${styles.tileEditable ?? ""}${typed}${caretClass}`;
}

function letterAt(
  judged: TermoJudgedRow | undefined,
  held: string | null,
  slot: number,
): string {
  if (judged !== undefined) {
    return judged.guess.charAt(slot);
  }
  return held === null ? "" : held.charAt(slot);
}
