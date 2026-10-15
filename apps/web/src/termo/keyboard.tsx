import type { KeyboardState, TileState } from "@miolos/games/termo";
import { memo, type ReactNode, type RefObject } from "react";

import { messages } from "../i18n";
import { KeyGlyph } from "../play/key-glyph";
import {
  LetterKeyboard,
  qwertySlots,
  type LetterKeyboardRow,
} from "../play/letter-keyboard";
import styles from "./termo-board.module.css";

const copy = messages.games.termo.play.keyboard;

export const KEY_ROWS = qwertySlots(["erase", "enter"]);

const KEY_STATE_CLASS = {
  correct: styles.keyCorrect,
  present: styles.keyPresent,
  absent: styles.keyAbsent,
} satisfies Record<TileState, string | undefined>;

export interface KeyHandlers {
  readonly onLetter: (letter: string) => void;
  readonly onEnter: () => void;
  readonly onErase: () => void;
}

export interface KeyboardProps extends KeyHandlers {
  readonly state: KeyboardState;

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
    keys: row.map(({ id, column, span }) => ({
      id,
      column,
      span,
      label: labelFor(id),
      ariaLabel: ariaFor(id, state),
      className: keyClassName(id, state),
      onActivate: () => {
        activateKey(id, { onLetter, onEnter, onErase });
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
          className={`${keyClassName(id, {})} ${styles.placeholder}`}
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

function keyClassName(id: string, state: KeyboardState): string | undefined {
  const tile = state[id];
  return tile === undefined
    ? styles.key
    : `${styles.key} ${KEY_STATE_CLASS[tile]}`;
}

export function activateKey(id: string, handlers: KeyHandlers): void {
  if (id === "enter") {
    handlers.onEnter();
  } else if (id === "erase") {
    handlers.onErase();
  } else {
    handlers.onLetter(id);
  }
}

export function labelFor(id: string): ReactNode {
  if (id === "enter") {
    return <KeyGlyph name="enter" />;
  }
  return id === "erase" ? <KeyGlyph name="backspace" /> : id;
}

export function ariaFor(id: string, state: KeyboardState): string {
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
