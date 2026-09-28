import { memo, type RefObject } from "react";

import { messages } from "../i18n";
import {
  LetterKeyboard,
  type LetterKeyboardRow,
} from "../play/letter-keyboard";
import styles from "./crossword-keyboard.module.css";

const copy = messages.games.crossword.play.keyboard;

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

const COMMAND_SPAN = 3;
const LETTER_SPAN = 2;

export interface KeyboardProps {
  readonly onLetter: (letter: string) => void;
  readonly onErase: () => void;

  readonly activeKeyRef: RefObject<HTMLButtonElement | null>;
}

export const Keyboard = memo(function Keyboard({
  onLetter,
  onErase,
  activeKeyRef,
}: KeyboardProps) {
  const rows: readonly LetterKeyboardRow[] = KEY_ROWS.map((row) => ({
    keys: row.map(([id, column]) => ({
      id,
      column,
      span: id === "erase" ? COMMAND_SPAN : LETTER_SPAN,
      label: id === "erase" ? copy.erase : id,
      ariaLabel: id === "erase" ? copy.eraseAria : copy.letterAria(id),
      className:
        id === "erase" ? `${styles.key} ${styles.keyCommand}` : styles.key,
      onActivate: () => {
        if (id === "erase") {
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
          className={`${id === "erase" ? `${styles.key} ${styles.keyCommand}` : styles.key} ${styles.placeholder}`}
          style={{
            gridColumn: `${String(column)} / span ${String(id === "erase" ? COMMAND_SPAN : LETTER_SPAN)}`,
          }}
        >
          {id === "erase" ? copy.erase : id}
        </div>
      ))}
    </div>
  );
}
