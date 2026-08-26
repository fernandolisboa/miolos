import type { BinairoGrid } from "@miolos/games/binairo";

import { messages } from "../i18n";
import { usePointerStroke } from "../play/use-pointer-stroke";
import styles from "./binairo-screen.module.css";
import type { CellValue } from "./state";

const COLUMNS = 8;

/**
 * The 8×8 board. Playable cells are real `<button>`s so the whole grid works
 * from the keyboard; givens are inert `<div>`s carrying `aria-disabled` —
 * they are not buttons because they can never be pressed, and 32 dead tab
 * stops would be worse than none.
 *
 * Arrow-key roving focus is deliberately out of this ticket: the grid ships
 * 64 ordinary tab stops rather than a `role="grid"` that promises keyboard
 * navigation it does not implement.
 */
export function Grid({
  givens,
  entries,
  violating,
  hintIndex,
  painting,
  onTap,
  onPaintOver,
}: {
  readonly givens: BinairoGrid;
  readonly entries: readonly CellValue[];
  readonly violating: ReadonlySet<number>;
  readonly hintIndex: number | null;
  /** True in paint/erase mode; a drag in cycle mode is chaos, so it does nothing. */
  readonly painting: boolean;
  readonly onTap: (index: number) => void;
  readonly onPaintOver: (index: number) => void;
}) {
  const stroke = usePointerStroke({ painting, onTap, onPaintOver });

  return (
    <div className={styles.grid} {...stroke.handlers}>
      {givens.map((given, index) => {
        const row = Math.floor(index / COLUMNS) + 1;
        const column = (index % COLUMNS) + 1;
        if (given !== null) {
          return (
            <div
              key={index}
              className={`${styles.cell} ${styles.cellGiven}`}
              data-cell-index={index}
              aria-disabled="true"
              aria-label={messages.games.binairo.play.cellGivenAria(
                row,
                column,
                given,
              )}
            >
              {given}
            </div>
          );
        }
        const value = entries[index] ?? null;
        const invalid = violating.has(index);
        return (
          <button
            key={index}
            type="button"
            className={cellClassName(value, invalid, hintIndex === index)}
            data-cell-index={index}
            // The plan's cell table asks for aria-invalid here; ARIA does not
            // support it on role=button and `jsx-a11y/role-supports-aria-props`
            // reds the lint gate, so the violation rides in the composed
            // accessible name instead — composed in messages.ts, never here
            // (ADR-0018). Three carriers remain — the doubled hairline, the
            // red, and that sentence — so colour is still never the sole one.
            aria-label={
              invalid
                ? messages.games.binairo.play.cellInvalidAria(
                    row,
                    column,
                    value,
                  )
                : messages.games.binairo.play.cellAria(row, column, value)
            }
            onClick={(event) => {
              // A drag has already applied every cell it crossed and a paint
              // tap was already applied on `pointerup`; the browser fires a
              // trailing `click` on top of both, and in paint mode `tap`
              // TOGGLES, so honouring it would undo what the stroke wrote.
              // `detail` is 0 for a keyboard activation and >= 1 for a
              // pointer one, so Enter/Space still writes while a latch is up.
              if (stroke.consumedClick(event)) {
                return;
              }
              onTap(index);
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function cellClassName(
  value: CellValue,
  invalid: boolean,
  hinted: boolean,
): string {
  if (invalid) {
    // The error state outranks the hint highlight: a cell that breaks a rule
    // has to say so even when a hint just wrote its neighbour.
    return `${styles.cell} ${styles.cellViolating}`;
  }
  if (hinted) {
    return `${styles.cell} ${styles.cellHinted}`;
  }
  return `${styles.cell}${value === null ? "" : ` ${styles.cellEntered}`}`;
}
