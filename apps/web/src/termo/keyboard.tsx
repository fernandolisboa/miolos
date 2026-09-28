import type { KeyboardState, TileState } from "@miolos/games/termo";
import { memo, type RefObject } from "react";

import { messages } from "../i18n";
import {
  LetterKeyboard,
  type LetterKeyboardRow,
} from "../play/letter-keyboard";
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
  const rows: readonly LetterKeyboardRow[] = KEY_ROWS.map((row) => ({
    keys: row.map(([id, column]) => ({
      id,
      column,
      span: spanOf(id),
      label: labelFor(id),
      ariaLabel: ariaFor(id, state),
      className: keyClassName(id, state),
      onActivate: () => {
        if (id === "enter") {
          onEnter();
        } else if (id === "erase") {
          onErase();
        } else {
          onLetter(id);
        }
      },
    })),
  }));

  return (
    <LetterKeyboard
      rows={rows}
      groupClassName={styles.keyboard ?? ""}
      groupLabel={copy.label}
      activeKeyRef={activeKeyRef}
    />
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
