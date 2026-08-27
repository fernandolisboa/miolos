import { messages } from "../i18n";
import type { SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";

const DIGITS: readonly SudokuDigit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function Keypad({
  onDigit,
  onClear,
}: {
  readonly onDigit: (digit: SudokuDigit) => void;
  readonly onClear: () => void;
}) {
  const copy = messages.games.sudoku.play.keypad;

  return (
    <div className={styles.keypad}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={styles.keypadDigit}
          aria-label={copy.digitAria(digit)}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <span className={styles.affordance}>{copy.affordance}</span>
      <button
        type="button"
        className={styles.keypadErase}
        aria-label={copy.eraseAria}
        onClick={onClear}
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
