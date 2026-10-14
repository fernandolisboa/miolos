import type { BinairoGrid } from "@miolos/games/binairo";

import { messages } from "../i18n";
import type { Press } from "../play/brush";
import spotlightStyles from "../play/spotlight.module.css";
import { usePointerStroke } from "../play/use-pointer-stroke";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import styles from "./binairo-screen.module.css";
import type { CellValue } from "./state";

const COLUMNS = 8;

export function Grid({
  givens,
  solution,
  entries,
  violating,
  hintIndex,
  spotlight,
  painting,
  onTap,
  onStrokeStart,
  onPaintOver,
}: {
  readonly givens: BinairoGrid;
  readonly solution: readonly (0 | 1)[] | null;
  readonly entries: readonly CellValue[];
  readonly violating: ReadonlySet<number>;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];

  readonly painting: boolean;
  readonly onTap: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;
  readonly onPaintOver: (index: number) => void;
}) {
  const stroke = usePointerStroke({
    painting,
    onTap,
    onStrokeStart,
    onPaintOver,
  });

  const wrong = useWrongCells("binairo", solution, givens, entries);

  return (
    <div className={styles.grid} {...stroke.handlers}>
      {givens.map((given, index) => {
        const row = Math.floor(index / COLUMNS) + 1;
        const column = (index % COLUMNS) + 1;
        const spotlit = spotlight.includes(index);
        if (given !== null) {
          return (
            <div
              key={index}
              className={`${styles.cell} ${styles.cellGiven}${spotlit ? ` ${spotlightStyles.spotlit}` : ""}`}
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
        const isWrong = wrong.has(index);
        const label = invalid
          ? messages.games.binairo.play.cellInvalidAria(row, column, value)
          : messages.games.binairo.play.cellAria(row, column, value);
        return (
          <button
            key={index}
            type="button"
            className={cellClassName(
              value,
              invalid,
              hintIndex === index,
              spotlit,
            )}
            data-cell-index={index}

            aria-label={isWrong ? messages.play.wrongCell(label) : label}
            onClick={(event) => {
              const press = stroke.clickPress(event);
              if (press !== null) {
                onTap(index, press);
              }
            }}
          >
            {value}
            {isWrong ? <WrongMark /> : null}
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
  spotlit: boolean,
): string {
  const tint = spotlit ? ` ${spotlightStyles.spotlit}` : "";
  if (invalid) {
    return `${styles.cell} ${styles.cellViolating}${tint}`;
  }
  if (hinted) {
    return `${styles.cell} ${styles.cellHinted}${tint}`;
  }
  return `${styles.cell}${value === null ? "" : ` ${styles.cellEntered}`}${tint}`;
}
