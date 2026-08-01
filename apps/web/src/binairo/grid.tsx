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
  /** True once `onPointerUp` has already applied this stroke's tap. */
  const tapped = useRef(false);
  const startIndex = useRef<number | null>(null);
  const lastIndex = useRef<number | null>(null);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Primary button only, and before any ref is touched. A stroke that
    // never opens leaves `dragging.current` false, so `onPointerUp` below
    // no-ops on its own guard and a right- or middle-click writes nothing
    // (finding `right-button-pointerup-writes-a-cell`). It used to be
    // impossible: the browser fires `auxclick`, not `click`, for a
    // non-primary button, so the cell's own handler was never reached —
    // resolving the tap on `pointerup` is what made the button matter.
    // NOT `isPrimary`: a single touch contact reports `button === 0` and
    // `isPrimary === true`, and a pen contacting with the barrel button
    // held still reports `button === 0`, so touch and pen are untouched.
    if (event.button !== 0) {
      return;
    }
    dragged.current = false;
    tapped.current = false;
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

  /**
   * A tap in paint/erase mode is resolved HERE, never by the cell's `click`
   * (finding `paint-mode-tap-dead-under-pointer-capture`). `onPointerDown`
   * takes pointer capture on this container, and the browser then retargets
   * the trailing `click` to the container too — so the cell button's own
   * handler is never in that event's propagation path and a stationary tap
   * would write nothing at all. Issue #18 asks for "tap-to-cycle plus a
   * paint mode"; without this, paint and erase are drag-only.
   *
   * Both latches below are set here and cleared by the NEXT `pointerdown`,
   * so the state a `click` reads always belongs to the stroke that produced
   * it.
   */
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = startIndex.current;
    if (
      dragging.current &&
      !dragged.current &&
      start !== null &&
      cellIndexAt(event.clientX, event.clientY) === start
    ) {
      tapped.current = true;
      onTap(start);
    }
    endDrag();
  };

  return (
    <div
      className={styles.grid}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
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
            // accessible name instead — composed in messages.ts, never here
            // (ADR-0018). Three carriers remain — the doubled hairline, the
            // red, and that sentence — so colour is still never the sole one.
            aria-label={
              invalid
                ? messages.binairo.cellInvalidAria(row, column, value)
                : messages.binairo.cellAria(row, column, value)
            }
            onClick={(event) => {
              // A drag has already applied every cell it crossed and a paint
              // tap was already applied on `pointerup`; the browser fires a
              // trailing `click` on top of both, and in paint mode `tap`
              // TOGGLES, so honouring it would undo what the stroke wrote.
              // `detail` is 0 for a keyboard activation and >= 1 for a
              // pointer one, so Enter/Space still writes while a latch is up
              // (finding `drag-flag-kills-keyboard-cell-entry`).
              if (event.detail > 0 && (dragged.current || tapped.current)) {
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
