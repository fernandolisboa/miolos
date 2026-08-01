import { messages } from "../i18n";
import type { SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";

/**
 * The nine writing keys, in the order the stylesheet places them: digit *n*
 * is the *n*th child, which is how `.keypadDigit:nth-child()` puts it under
 * board column *n* without an inline style a media query could not override
 * (§12.6). Reordering this array silently moves the desktop keypad, which is
 * why the CSS carries the same note and T-WEB-S34 re-derives the columns from
 * `track()`.
 */
const DIGITS: readonly SudokuDigit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The keypad (plan 018 §12.6). These are COMMANDS, not modes (S3): Binairo's
 * sticky paint model does not generalize — there is no plausible "paint 7s by
 * dragging" — so they are plain buttons with no `aria-pressed`, and the
 * physical keyboard's `1`–`9`/`Backspace` do the same job through the board's
 * own listener (ADR-0030 decision 3).
 *
 * Desktop: the digit row shares the board's exact track template, so digit
 * *n* sits directly under column *n* and the box rhythm is legible twice;
 * the affordance and `apagar` share row 2 on box boundaries.
 * Mobile: four columns × three rows, `apagar` spanning the last three.
 */
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

/**
 * The placeholder keypad (§12.2). Divs rather than buttons, so nothing here
 * is focusable or announced before it works — but every box the hydrated
 * keypad occupies is reserved, including all three mobile rows, because
 * `.board` is a centred flex column and a missing row hands its height to the
 * board as an OFFSET (finding `play-skeleton-is-not-at-final-dimensions`).
 *
 * Labelled, unlike the play screen's readouts: a digit key's label is a
 * constant, so this row owes the record nothing and can paint complete.
 */
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
