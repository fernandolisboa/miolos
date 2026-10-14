import { memo, type ReactNode, type RefObject } from "react";

import { messages } from "../i18n";
import { KeyGlyph } from "../play/key-glyph";
import {
  LetterKeyboard,
  qwertySlots,
  type LetterKeyboardRow,
} from "../play/letter-keyboard";
import styles from "./crossword-keyboard.module.css";

const copy = messages.games.crossword.play.keyboard;

const KEY_ROWS = qwertySlots(["erase"]);

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
    keys: row.map(({ id, column, span }) => ({
      id,
      column,
      span,
      label: labelFor(id),
      ariaLabel: id === "erase" ? copy.eraseAria : copy.letterAria(id),
      className: styles.key,
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
      {KEY_ROWS.flat().map(({ id, column, span }) => (
        <div
          key={id}
          className={`${styles.key} ${styles.placeholder}`}
          style={{
            gridColumn: `${String(column)} / span ${String(span)}`,
          }}
        >
          {labelFor(id)}
        </div>
      ))}
    </div>
  );
}

function labelFor(id: string): ReactNode {
  return id === "erase" ? <KeyGlyph name="backspace" /> : id;
}
