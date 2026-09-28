import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

import { messages } from "../i18n";
import { typedLetter } from "../play/typed-letter";
import {
  activeEntry,
  colOf,
  entryCells,
  firstPlayableIndex,
  GRID_SIZE,
  isBlock,
  rowOf,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import styles from "./crossword-board.module.css";

const copy = messages.games.crossword.play;

export function focusBoard(board: HTMLElement | null): void {
  board
    ?.querySelector<HTMLButtonElement>('[data-cell-index][tabindex="0"]')
    ?.focus();
}

function numbering(
  clues: readonly CrosswordClue[],
): ReadonlyMap<number, number> {
  const map = new Map<number, number>();
  for (const clue of clues) {
    const index = clue.row * GRID_SIZE + clue.col;
    if (!map.has(index)) {
      map.set(index, clue.number);
    }
  }
  return map;
}

export function Board({
  boardRef,
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
  const numbers = numbering(clues);
  const tabbable = selected ?? firstPlayableIndex(solution);
  const clue =
    selected === null ? undefined : activeEntry(clues, selected, direction);
  const activeCells = new Set(clue === undefined ? [] : entryCells(clue));

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (selected !== null && board?.contains(document.activeElement)) {
      focusBoard(board);
    }
  }, [boardRef, selected]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const move = MOVES[event.key];
    if (move !== undefined) {
      event.preventDefault();
      onMove(move[0], move[1]);
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
      className={styles.grid}
      role="group"
      aria-label={copy.boardAria}
      onKeyDown={onKeyDown}
    >
      {solution.map((cell, index) => {
        const row = rowOf(index);
        const column = colOf(index);
        const blocked = isBlock(solution, index);
        const value = entries[index] ?? null;
        const number = numbers.get(index);

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
              blocked
                ? copy.blockAria
                : copy.cellAria(row + 1, column + 1, value)
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
          </button>
        );
      })}
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div aria-hidden className={styles.grid}>
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_unused, index) => (
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

const MOVES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  Home: [0, -GRID_SIZE + 1],
  End: [0, GRID_SIZE - 1],
};
