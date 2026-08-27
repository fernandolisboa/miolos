import { fireEvent, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePointerStroke } from "../src/play/use-pointer-stroke";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

installPointerStubs();

afterEach(() => {
  vi.restoreAllMocks();
});

const CELLS = 9;

function StrokeHarness({
  painting = true,
  wired = true,
  onEnd,
}: {
  readonly painting?: boolean;

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

describe("a stroke that never took pointer capture (T-WEB-S59)", () => {
  function throwOnCapture(): void {
    vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {
      throw new Error("pens that release early throw here");
    });
  }

  it("still ends when the pointer lifts outside the board", () => {
    throwOnCapture();
    const { container } = render(<StrokeHarness />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });

    fireEvent.pointerUp(window, { clientX: 500, clientY: 500, pointerId: 1 });

    fireEvent.pointerDown(board, { clientX: 5, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 5, clientY: 0, pointerId: 2 });

    expect(cellAt(container, 5).textContent).toBe("1");
  });

  it("still ends on a window pointercancel", () => {
    throwOnCapture();
    const { container } = render(<StrokeHarness />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerCancel(window, { pointerId: 1 });

    fireEvent.pointerDown(board, { clientX: 6, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 6, clientY: 0, pointerId: 2 });

    expect(cellAt(container, 6).textContent).toBe("1");
  });

  it("leaves nothing on window once the stroke is closed", () => {
    throwOnCapture();
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = render(<StrokeHarness />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    const pointerListeners = (spy: typeof added) =>
      spy.mock.calls.filter(([type]) => type.startsWith("pointer")).length;

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(pointerListeners(added)).toBe(2);

    fireEvent.pointerUp(board, { clientX: 0, clientY: 0, pointerId: 1 });
    expect(pointerListeners(removed)).toBe(2);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 3 });
    expect(pointerListeners(added)).toBe(4);
    unmount();
    expect(pointerListeners(removed)).toBe(4);
  });

  it("arms the same net for a board that never paints", () => {
    const added = vi.spyOn(window, "addEventListener");
    const { container } = render(
      <StrokeHarness painting={false} wired={false} />,
    );
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });

    expect(
      added.mock.calls
        .map(([type]) => type)
        .filter((type) => type.startsWith("pointer")),
    ).toStrictEqual(["pointerup", "pointercancel"]);
  });
});
