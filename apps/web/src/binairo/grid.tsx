import type { BinairoGrid } from "@miolos/games/binairo";

import { messages } from "../i18n";
import { usePointerStroke } from "../play/use-pointer-stroke";
import styles from "./binairo-screen.module.css";
import type { CellValue } from "./state";

const COLUMNS = 8;

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
    return `${styles.cell} ${styles.cellViolating}`;
  }
  if (hinted) {
    return `${styles.cell} ${styles.cellHinted}`;
  }
  return `${styles.cell}${value === null ? "" : ` ${styles.cellEntered}`}`;
}
