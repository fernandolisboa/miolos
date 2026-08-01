import type { BinairoGrid } from "@miolos/games/binairo";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

import { messages } from "../i18n";
import styles from "./binairo-screen.module.css";
import type { CellValue } from "./state";

const COLUMNS = 8;

/**
 * The 8×8 board (plan 017 §12.2). Playable cells are real `<button>`s so
 * the whole grid works from the keyboard; givens are inert `<div>`s
 * carrying `aria-disabled` — they are not buttons because they can never
 * be pressed, and 32 dead tab stops would be worse than none.
 *
 * Arrow-key roving focus is deliberately out of this ticket (§8.2): the
 * grid ships 64 ordinary tab stops rather than a `role="grid"` that
 * promises keyboard navigation it does not implement.
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
  /** True in paint/erase mode; a drag in cycle mode is chaos, so it does nothing (D8). */
  readonly painting: boolean;
  readonly onTap: (index: number) => void;
  readonly onPaintOver: (index: number) => void;
}) {
  const dragging = useRef(false);
  const dragged = useRef(false);
  const startIndex = useRef<number | null>(null);
  const lastIndex = useRef<number | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragged.current = false;
    dragging.current = painting;
    const index = cellIndexAt(event.clientX, event.clientY);
    startIndex.current = index;
    lastIndex.current = index;
    if (!painting) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom and pens that release early both throw here; capture is an
      // optimisation, and `elementFromPoint` resolves the cell either way.
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) {
      return;
    }
    // Required, not defensive: under pointer capture — and on touch
    // generally — `pointerenter` never fires on the cells being crossed, so
    // the only way to know which cell is under the pointer is to ask.
    const index = cellIndexAt(event.clientX, event.clientY);
    if (index === null || index === lastIndex.current) {
      return;
    }
    if (!dragged.current) {
      dragged.current = true;
      // The cell the stroke began on: `click` will be suppressed below, so
      // without this the first cell of every drag would be skipped.
      if (startIndex.current !== null) {
        onPaintOver(startIndex.current);
      }
    }
    lastIndex.current = index;
    onPaintOver(index);
  };

  const endDrag = () => {
    dragging.current = false;
  };

  return (
    <div
      className={styles.grid}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
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
              aria-label={messages.binairo.cellGivenAria(row, column, given)}
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
            // accessible name instead. Three carriers remain — the doubled
            // hairline, the red, and this sentence — so colour is still never
            // the sole one.
            aria-label={
              invalid
                ? `${messages.binairo.cellAria(row, column, value)} — ${messages.binairo.cellInvalidAria}`
                : messages.binairo.cellAria(row, column, value)
            }
            onClick={() => {
              // A drag has already applied every cell it crossed, and the
              // browser fires a trailing `click` on the release target; in
              // paint mode `tap` TOGGLES, so honouring it would undo the
              // stroke's first cell. Keyboard activation never sets this.
              if (dragged.current) {
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

/** The cell under a client point, or `null` outside the board. */
function cellIndexAt(x: number, y: number): number | null {
  const target = document.elementFromPoint(x, y);
  const cell = target?.closest("[data-cell-index]");
  const raw = cell?.getAttribute("data-cell-index");
  if (raw === null || raw === undefined) {
    return null;
  }
  const index = Number.parseInt(raw, 10);
  return Number.isInteger(index) ? index : null;
}
