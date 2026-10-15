import type { SudokuGrid } from "@miolos/games/sudoku";

import { messages } from "../i18n";
import { KeyGlyph } from "../play/key-glyph";
import { digitTally, placedCount, type DigitTally } from "./engine";
import type { SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";
import type { DigitLock } from "./use-digit-lock";

const DIGITS: readonly SudokuDigit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const TALLY_CLASS: Readonly<Record<DigitTally, string | undefined>> = {
  open: undefined,
  complete: styles.keypadComplete,
  over: styles.keypadOver,
};

export function Keypad({
  lock,
  grid,
}: {
  readonly lock: DigitLock;
  readonly grid: SudokuGrid;
}) {
  const copy = messages.games.sudoku.play.keypad;

  return (
    <div className={styles.keypad}>
      {DIGITS.map((digit) => {
        const count = placedCount(grid, digit);
        const tally = digitTally(count);
        return (
          <button
            key={digit}
            type="button"
            className={[styles.keypadDigit, TALLY_CLASS[tally]]
              .filter((name) => name !== undefined)
              .join(" ")}
            aria-label={digitAria(digit, tally, count)}
            aria-pressed={lock.enabled ? lock.locked === digit : undefined}
            onClick={(event) => {
              lock.pressDigit(digit, event.detail > 0);
            }}
          >
            {digit}
            {tally === "open" ? null : (
              <span aria-hidden className={styles.keypadMark}>
                {tally === "complete" ? "✓" : count}
              </span>
            )}
          </button>
        );
      })}
      <span className={styles.affordance}>{copy.affordance}</span>
      <button
        type="button"
        className={styles.keypadErase}
        aria-label={copy.eraseAria}
        onClick={(event) => {
          lock.pressErase(event.detail > 0);
        }}
      >
        <KeyGlyph name="backspace" />
      </button>
    </div>
  );
}

function digitAria(digit: SudokuDigit, tally: DigitTally, count: number) {
  const copy = messages.games.sudoku.play.keypad;
  switch (tally) {
    case "open":
      return copy.digitAria(digit);
    case "complete":
      return copy.digitCompleteAria(digit);
    case "over":
      return copy.digitOverAria(digit, count);
  }
}

export function KeypadSkeleton() {
  const copy = messages.games.sudoku.play.keypad;

  return (
    <div aria-hidden className={styles.keypad}>
      {DIGITS.map((digit) => (
        <div
          key={digit}
          className={`${styles.keypadDigit} ${styles.placeholder}`}
        >
          {digit}
        </div>
      ))}
      <span className={styles.affordance}>{copy.affordance}</span>
      <div className={`${styles.keypadErase} ${styles.placeholder}`}>
        <KeyGlyph name="backspace" />
      </div>
    </div>
  );
}
