import { messages } from "../i18n";
import type { SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";
import type { DigitLock } from "./use-digit-lock";

const DIGITS: readonly SudokuDigit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function Keypad({ lock }: { readonly lock: DigitLock }) {
  const copy = messages.games.sudoku.play.keypad;

  return (
    <div className={styles.keypad}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.keypadDigit}
          aria-label={copy.digitAria(digit)}
          aria-pressed={lock.enabled ? lock.locked === digit : undefined}
          onClick={(event) => {
            lock.pressDigit(digit, event.detail > 0);
          }}
        >
          {digit}
        </button>
      ))}
      <span className={styles.affordance}>{copy.affordance}</span>
      <button
        type="button"
        className={styles.keypadErase}
        aria-label={copy.eraseAria}
        onClick={(event) => {
          lock.pressErase(event.detail > 0);
        }}
      >
        {copy.erase}
      </button>
    </div>
  );
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
        {copy.erase}
      </div>
    </div>
  );
}
