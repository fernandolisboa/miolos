import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { messages } from "../i18n";
import { isShortcut, keyMove } from "../play/grid-selection";
import { typedLetter } from "../play/typed-letter";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import {
  activeEntry,
  colOf,
  entryCells,
  firstPlayableIndex,
  indexOf,
  isBlock,
  rowOf,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import styles from "./crossword-board.module.css";
import { gridClassName, gridStyle } from "./size-classes";

const copy = messages.games.crossword.play;

export function focusBoard(board: HTMLElement | null): void {
  board
    ?.querySelector<HTMLButtonElement>('[data-cell-index][tabindex="0"]')
    ?.focus({ preventScroll: true });
}

function numbering(
  clues: readonly CrosswordClue[],
  size: number,
): ReadonlyMap<number, number> {
  const map = new Map<number, number>();
  for (const clue of clues) {
    const index = indexOf(clue.row, clue.col, size);
    if (!map.has(index)) {
      map.set(index, clue.number);
    }
  }
  return map;
}

export function Board({
  boardRef,
  size,
  solution,
  clues,
  entries,
  selected,
  direction,
  hintIndex,
  onSelect,
  onToggleDirection,
  onMove,
  onLetter,
  onBackspace,
}: {
  readonly boardRef: RefObject<HTMLDivElement | null>;
  readonly size: number;
  readonly solution: readonly (string | null)[];
  readonly clues: readonly CrosswordClue[];
  readonly entries: readonly (string | null)[];

  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly hintIndex: number | null;
  readonly onSelect: (index: number) => void;
  readonly onToggleDirection: () => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onLetter: (letter: string) => void;
  readonly onBackspace: () => void;
}) {
  const wasSelectedRef = useRef(false);
  const wrong = useWrongCells("crossword", solution, null, entries);
  const numbers = numbering(clues, size);
  const tabbable = selected ?? firstPlayableIndex(solution);
  const clue =
    selected === null
      ? undefined
      : activeEntry(clues, selected, direction, size);
  const activeCells = new Set(clue === undefined ? [] : entryCells(clue, size));

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (selected !== null && board?.contains(document.activeElement)) {
      focusBoard(board);
    }
  }, [boardRef, selected]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isShortcut(event)) {
      return;
    }
    const move = keyMove(event.key, size);
    if (move !== null) {
      event.preventDefault();
      onMove(move.rows, move.columns);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      onBackspace();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleDirection();
      return;
    }
    const letter = typedLetter(event.key);
    if (letter !== null) {
      event.preventDefault();
      onLetter(letter);
    }
  };

  return (
    <div
      ref={boardRef}
      className={gridClassName(size)}
      style={gridStyle(size)}
      role="group"
      aria-label={copy.boardAria(size)}
      onKeyDown={onKeyDown}
    >
      {solution.map((cell, index) => {
        const row = rowOf(index, size);
        const column = colOf(index, size);
        const blocked = isBlock(solution, index);
        const value = entries[index] ?? null;
        const number = numbers.get(index);
        const label = blocked
          ? copy.blockAria
          : copy.cellAria(row + 1, column + 1, value);

        return (
          <button
            key={index}
            type="button"
            className={cellClassName({
              blocked,
              selected: index === selected,
              active: activeCells.has(index),
              hinted: hintIndex === index,
            })}
            data-cell-index={index}
            tabIndex={tabbable === index ? 0 : -1}
            aria-disabled={blocked}
            aria-label={
              wrong.has(index) ? messages.play.wrongCell(label) : label
            }
            onFocus={() => {
              onSelect(index);
            }}
            onPointerDown={() => {
              wasSelectedRef.current = selected === index;
            }}
            onClick={(event) => {
              event.currentTarget.focus();
              if (!blocked && wasSelectedRef.current) {
                onToggleDirection();
              }
            }}
          >
            {number === undefined ? null : (
              <span aria-hidden className={styles.number}>
                {number}
              </span>
            )}
            {blocked ? null : value}
            {wrong.has(index) ? <WrongMark /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function BoardSkeleton({ size }: { readonly size: number }) {
  return (
    <div aria-hidden className={gridClassName(size)} style={gridStyle(size)}>
      {Array.from({ length: size * size }, (_unused, index) => (
        <div key={index} className={`${styles.cell} ${styles.cellSkeleton}`} />
      ))}
    </div>
  );
}

function cellClassName(state: {
  readonly blocked: boolean;
  readonly selected: boolean;
  readonly active: boolean;
  readonly hinted: boolean;
}): string {
  if (state.blocked) {
    return `${styles.cell} ${styles.cellBlock}`;
  }
  const chromatic = state.hinted
    ? ` ${styles.cellHinted}`
    : state.active
      ? ` ${styles.cellActive}`
      : "";
  return `${styles.cell}${chromatic}${state.selected ? ` ${styles.cellSelected}` : ""}`;
}
