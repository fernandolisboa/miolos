import type { KeyboardState, TileState } from "@miolos/games/termo";
import {
  memo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";

import { messages } from "../i18n";
import styles from "./termo-board.module.css";

const copy = messages.games.termo.play.keyboard;

const KEY_ROWS = [
  [
    ["q", 1],
    ["w", 3],
    ["e", 5],
    ["r", 7],
    ["t", 9],
    ["y", 11],
    ["u", 13],
    ["i", 15],
    ["o", 17],
    ["p", 19],
  ],
  [
    ["a", 2],
    ["s", 4],
    ["d", 6],
    ["f", 8],
    ["g", 10],
    ["h", 12],
    ["j", 14],
    ["k", 16],
    ["l", 18],
  ],
  [
    ["enter", 1],
    ["z", 4],
    ["x", 6],
    ["c", 8],
    ["v", 10],
    ["b", 12],
    ["n", 14],
    ["m", 16],
    ["erase", 18],
  ],
] as const;

export type KeyId = (typeof KEY_ROWS)[number][number][0];

const POSITION: ReadonlyMap<KeyId, readonly [number, number]> = new Map(
  KEY_ROWS.flatMap((row, rowIndex) =>
    row.map(([id], column) => [id, [rowIndex, column]] as const),
  ),
);

const SEED: KeyId = "q";

const ROW_END = Number.MAX_SAFE_INTEGER;

const COMMAND_SPAN = 3;
const LETTER_SPAN = 2;

const KEY_STATE_CLASS = {
  correct: styles.keyCorrect,
  present: styles.keyPresent,
  absent: styles.keyAbsent,
} satisfies Record<TileState, string | undefined>;

export interface KeyboardProps {
  readonly state: KeyboardState;
  readonly onLetter: (letter: string) => void;
  readonly onEnter: () => void;
  readonly onErase: () => void;

  readonly activeKeyRef: RefObject<HTMLButtonElement | null>;
}

export const Keyboard = memo(function Keyboard({
  state,
  onLetter,
  onEnter,
  onErase,
  activeKeyRef,
}: KeyboardProps) {
  const [focused, setFocused] = useState<KeyId>(SEED);
  const keys = useRef(new Map<KeyId, HTMLButtonElement>());

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const next = nextKey(
      idOfNode(keys.current, event.target) ?? focused,
      event.key,
    );
    if (next === null) {
      return;
    }

    event.preventDefault();

    keys.current.get(next)?.focus();
  };

  const onClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
    id: KeyId,
  ): void => {
    if (event.detail !== 0) {
      event.currentTarget.blur();
    }
    if (id === "enter") {
      onEnter();
      return;
    }
    if (id === "erase") {
      onErase();
      return;
    }
    onLetter(id);
  };

  return (
    <div
      className={styles.keyboard}
      role="group"
      aria-label={copy.label}
      onKeyDown={onKeyDown}
    >
      {KEY_ROWS.flat().map(([id, column]) => (
        <button
          key={id}
          type="button"
          className={keyClassName(id, state)}
          style={{
            gridColumn: `${String(column)} / span ${String(spanOf(id))}`,
          }}

          tabIndex={id === focused ? 0 : -1}
          ref={(node) => {
            if (node === null) {
              keys.current.delete(id);
              return;
            }
            keys.current.set(id, node);
            if (id === focused) {
              activeKeyRef.current = node;
            }
          }}
          aria-label={ariaFor(id, state)}
          onFocus={() => {
            setFocused(id);
          }}
          onClick={(event) => {
            onClick(event, id);
          }}
        >
          {labelFor(id)}
        </button>
      ))}
    </div>
  );
});

export function KeyboardSkeleton() {
  return (
    <div aria-hidden className={styles.keyboard}>
      {KEY_ROWS.flat().map(([id, column]) => (
        <div
          key={id}
          className={`${keyClassName(id, {})} ${styles.placeholder}`}
          style={{
            gridColumn: `${String(column)} / span ${String(spanOf(id))}`,
          }}
        >
          {labelFor(id)}
        </div>
      ))}
    </div>
  );
}

function isCommand(id: KeyId): boolean {
  return id === "enter" || id === "erase";
}

function spanOf(id: KeyId): number {
  return isCommand(id) ? COMMAND_SPAN : LETTER_SPAN;
}

function keyClassName(id: KeyId, state: KeyboardState): string | undefined {
  if (isCommand(id)) {
    return `${styles.key} ${styles.keyCommand}`;
  }
  const tile = state[id];
  return tile === undefined
    ? styles.key
    : `${styles.key} ${KEY_STATE_CLASS[tile]}`;
}

function labelFor(id: KeyId): string {
  if (id === "enter") {
    return copy.enter;
  }
  return id === "erase" ? copy.erase : id;
}

function ariaFor(id: KeyId, state: KeyboardState): string {
  if (id === "enter") {
    return copy.enterAria;
  }
  if (id === "erase") {
    return copy.eraseAria;
  }
  const tile = state[id];
  return tile === undefined
    ? copy.letterAria(id)
    : copy.letterStateAria(id, tile);
}

function nextKey(id: KeyId, key: string): KeyId | null {
  const position = POSITION.get(id);
  if (position === undefined) {
    return null;
  }
  const [row, column] = position;
  switch (key) {
    case "ArrowLeft":
      return keyAt(row, column - 1);
    case "ArrowRight":
      return keyAt(row, column + 1);
    case "ArrowUp":
      return keyAt(row - 1, column);
    case "ArrowDown":
      return keyAt(row + 1, column);
    case "Home":
      return keyAt(row, 0);
    case "End":
      return keyAt(row, ROW_END);
    default:
      return null;
  }
}

function idOfNode(
  registry: ReadonlyMap<KeyId, HTMLButtonElement>,
  target: EventTarget,
): KeyId | null {
  for (const [id, node] of registry) {
    if (node === target) {
      return id;
    }
  }
  return null;
}

function keyAt(row: number, column: number): KeyId | null {
  const keys = KEY_ROWS[clamp(row, KEY_ROWS.length)];
  if (keys === undefined) {
    return null;
  }
  return keys[clamp(column, keys.length)]?.[0] ?? null;
}

function clamp(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1);
}
