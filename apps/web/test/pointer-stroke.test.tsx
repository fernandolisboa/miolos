import { fireEvent, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePointerStroke } from "../src/play/use-pointer-stroke";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

// T-WEB-S45g (plan 020 §5.3, commit 6). The MECHANISM half: that
// `onStrokeEnd` hands the stroke's last cell back at `pointerup`, and that a
// board wiring it to `focus()` plus its caret state gets both. §19.2 row 2 is
// explicit that this is what the id proves — jsdom simulates neither pointer
// capture nor the click retargeting that makes the seam necessary, so no test
// here can prove it is what saves capture-retargeted input; that half was
// reproduced in a browser.
//
// It lives in its own file because `nonogram-screen.test.tsx` — the file §19
// lists T-WEB-S45 against — does not exist until build step 6 / commit 8,
// while §5.3's sequencing table makes T-WEB-S45g commit 6's gate. The id is
// spent HERE: the nonogram screen's stroke tests carry (a)–(f) and must not
// re-allocate (g), which is landmine N30's mistake.

installPointerStubs();

afterEach(() => {
  vi.restoreAllMocks();
});

const CELLS = 9;

/**
 * The smallest board that can show the seam working: a container carrying the
 * five handlers, nine cells resolved by `data-cell-index`, and a caret that —
 * exactly like a composite-widget board — lives in state and owns which cell
 * is the single tab stop.
 */
function StrokeHarness({
  painting = true,
  wired = true,
  onEnd,
}: {
  readonly painting?: boolean;
  /** False is Binairo: a board that omits the callback entirely. */
  readonly wired?: boolean;
  readonly onEnd?: (index: number) => void;
}) {
  const [painted, setPainted] = useState<readonly number[]>([]);
  const [caret, setCaret] = useState<number | null>(null);
  const cells = useRef(new Map<number, HTMLButtonElement>());

  const strokeEnd = (index: number) => {
    onEnd?.(index);
    setCaret(index);
    cells.current.get(index)?.focus();
  };

  const stroke = usePointerStroke({
    painting,
    onTap: (index) => setPainted((current) => [...current, index]),
    onPaintOver: (index) => setPainted((current) => [...current, index]),
    ...(wired ? { onStrokeEnd: strokeEnd } : {}),
  });

  return (
    <div data-testid="board" {...stroke.handlers}>
      {Array.from({ length: CELLS }, (_unused, index) => (
        <button
          key={index}
          type="button"
          data-cell-index={index}
          tabIndex={(caret ?? 0) === index ? 0 : -1}
          ref={(node) => {
            if (node !== null) {
              cells.current.set(index, node);
            }
          }}
          onClick={(event) => {
            if (stroke.consumedClick(event)) {
              return;
            }
            setPainted((current) => [...current, index]);
          }}
        >
          {painted.includes(index) ? "1" : ""}
        </button>
      ))}
    </div>
  );
}

function boardOf(container: HTMLElement): HTMLElement {
  const board = container.querySelector<HTMLElement>('[data-testid="board"]');
  if (board === null) {
    throw new Error("the harness board is missing");
  }
  return board;
}

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

describe("usePointerStroke's onStrokeEnd (T-WEB-S45g)", () => {
  it("hands back the cell a drag ended on, and the board focuses it", () => {
    const ended = vi.fn();
    const { container } = render(<StrokeHarness onEnd={ended} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 2, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 2, clientY: 0, pointerId: 1 });

    expect(ended.mock.calls).toStrictEqual([[2]]);
    expect(document.activeElement).toBe(cellAt(container, 2));
    // The caret is the board's, not the DOM's: the cell the stroke ended on
    // is the grid's single tab stop afterwards.
    expect(cellAt(container, 2)).toHaveAttribute("tabindex", "0");
    expect(cellAt(container, 0)).toHaveAttribute("tabindex", "-1");
  });

  it("hands back the cell a stationary tap ended on", () => {
    const ended = vi.fn();
    const { container } = render(<StrokeHarness onEnd={ended} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 4, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 4, clientY: 0, pointerId: 1 });

    expect(ended.mock.calls).toStrictEqual([[4]]);
    expect(document.activeElement).toBe(cellAt(container, 4));
    // The tap itself still wrote — moving focus is additive to the stroke.
    expect(cellAt(container, 4).textContent).toBe("1");
  });

  it("is not called when a non-primary button opens the stroke", () => {
    const ended = vi.fn();
    const { container } = render(<StrokeHarness onEnd={ended} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, {
      clientX: 3,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });
    fireEvent.pointerUp(board, {
      clientX: 3,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });

    expect(ended).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("is not called by a second contact lifting mid-stroke", () => {
    const ended = vi.fn();
    const { container } = render(<StrokeHarness onEnd={ended} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    // A palm or the holding thumb: it never opened the stroke, so it may not
    // end it — and it may not move the caret either.
    fireEvent.pointerDown(board, { clientX: 7, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 7, clientY: 0, pointerId: 2 });

    expect(ended).not.toHaveBeenCalled();

    fireEvent.pointerMove(board, { clientX: 2, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 2, clientY: 0, pointerId: 1 });

    expect(ended.mock.calls).toStrictEqual([[2]]);
  });

  it("hands nothing back when the pointer lifts off the board", () => {
    const ended = vi.fn();
    const { container } = render(<StrokeHarness onEnd={ended} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    // `clientX: 99` resolves to no cell — the stub maps x straight to an
    // index, and the harness has nine.
    fireEvent.pointerUp(board, { clientX: 99, clientY: 0, pointerId: 1 });

    expect(ended).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(document.body);
  });

  it("is optional — a board that omits it strokes exactly as before", () => {
    const { container } = render(<StrokeHarness wired={false} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 1, clientY: 0, pointerId: 1 });

    for (const index of [0, 1]) {
      expect(cellAt(container, index).textContent).toBe("1");
    }
    expect(document.activeElement).toBe(document.body);
  });
});
