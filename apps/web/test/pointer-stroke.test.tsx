import { fireEvent, render } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Press } from "../src/play/brush";
import { usePointerStroke } from "../src/play/use-pointer-stroke";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

installPointerStubs();

afterEach(() => {
  vi.restoreAllMocks();
});

const CELLS = 9;

interface Spies {
  readonly tap: (index: number, press: Press) => void;
  readonly start: (index: number, press: Press) => void;
  readonly over: (index: number) => void;
}

function StrokeHarness({
  painting = true,
  wired = true,
  onEnd,
  spies,
}: {
  readonly painting?: boolean;

  readonly wired?: boolean;
  readonly onEnd?: (index: number) => void;
  readonly spies?: Spies;
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
    onTap: (index, press) => {
      spies?.tap(index, press);
      setPainted((current) => [...current, index]);
    },
    onStrokeStart: (index, press) => {
      spies?.start(index, press);
      setPainted((current) => [...current, index]);
    },
    onPaintOver: (index) => {
      spies?.over(index);
      setPainted((current) => [...current, index]);
    },
    ...(wired ? { onStrokeEnd: strokeEnd } : {}),
  });

  return (
    <div>
      <div data-testid="outside" />
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
              const press = stroke.clickPress(event);
              if (press === null) {
                return;
              }
              spies?.tap(index, press);
              setPainted((current) => [...current, index]);
            }}
          >
            {painted.includes(index) ? "1" : ""}
          </button>
        ))}
      </div>
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

  it("is not called when a middle or extra button opens the stroke", () => {
    const ended = vi.fn();
    const { container } = render(<StrokeHarness onEnd={ended} />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, {
      clientX: 3,
      clientY: 0,
      pointerId: 1,
      button: 1,
    });
    fireEvent.pointerUp(board, {
      clientX: 3,
      clientY: 0,
      pointerId: 1,
      button: 1,
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

describe("the press a stroke opens with (T-WEB-S488)", () => {
  const PRESSES: readonly (readonly [string, number, Press | null])[] = [
    ["mouse", 0, "left"],
    ["mouse", 2, "right"],
    ["touch", 0, "tap"],
    ["pen", 0, "tap"],
    ["pen", 2, "right"],
    ["", 0, "tap"],
    ["mouse", 1, null],
    ["mouse", 3, null],
    ["mouse", 4, null],
  ];

  it.each(PRESSES)(
    "classifies a %s button %i press as %s",
    (pointerType, button, expected) => {
      const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
      const { container } = render(<StrokeHarness spies={spies} />);
      stubElementFromPoint(container);
      const board = boardOf(container);
      const init = {
        clientX: 4,
        clientY: 0,
        pointerId: 1,
        pointerType,
        button,
      };

      fireEvent.pointerDown(board, init);
      fireEvent.pointerUp(board, init);

      expect(spies.tap.mock.calls).toStrictEqual(
        expected === null ? [] : [[4, expected]],
      );
    },
  );

  it("does not treat a macOS Ctrl+click as a right press", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(<StrokeHarness spies={spies} />);
    stubElementFromPoint(container);
    const board = boardOf(container);
    const init = {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      ctrlKey: true,
    };

    fireEvent.pointerDown(board, init);
    fireEvent.pointerUp(board, init);

    expect(spies.tap.mock.calls).toStrictEqual([[4, "left"]]);
  });
});

describe("a tap resolves at pointerup for every press (T-WEB-S489)", () => {
  it("taps from pointerup with painting off, and consumes the trailing click", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(
      <StrokeHarness painting={false} spies={spies} />,
    );
    stubElementFromPoint(container);
    const board = boardOf(container);
    const init = { clientX: 2, clientY: 0, pointerId: 1, pointerType: "touch" };

    fireEvent.pointerDown(board, init);
    fireEvent.pointerUp(board, init);
    fireEvent.click(cellAt(container, 2), { detail: 1 });

    expect(spies.tap.mock.calls).toStrictEqual([[2, "tap"]]);
  });

  it("does not consume a keyboard click, which is a tap", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(
      <StrokeHarness painting={false} spies={spies} />,
    );
    stubElementFromPoint(container);
    const board = boardOf(container);
    const init = {
      clientX: 2,
      clientY: 0,
      pointerId: 1,
      pointerType: "mouse",
      button: 2,
    };

    fireEvent.pointerDown(board, init);
    fireEvent.pointerUp(board, init);
    fireEvent.click(cellAt(container, 5), { detail: 0 });

    expect(spies.tap.mock.calls).toStrictEqual([
      [2, "right"],
      [5, "tap"],
    ]);
  });

  it("(T-WEB-S489a) falls back to the press recorded at pointerdown when a slide lands its click on the start cell", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(
      <StrokeHarness painting={false} spies={spies} />,
    );
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, {
      clientX: 1,
      clientY: 0,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
    });
    fireEvent.pointerUp(board, { clientX: 2, clientY: 0, pointerId: 1 });
    fireEvent.click(cellAt(container, 1), { detail: 1 });

    expect(spies.tap.mock.calls).toStrictEqual([[1, "left"]]);
  });
});

describe("a stroke names its first cell once (T-WEB-S490)", () => {
  it("starts on the press cell, then paints over the later ones", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(<StrokeHarness spies={spies} />);
    stubElementFromPoint(container);
    const board = boardOf(container);
    const base = { clientY: 0, pointerId: 1, pointerType: "mouse", button: 2 };

    fireEvent.pointerDown(board, { ...base, clientX: 3 });
    fireEvent.pointerMove(board, { ...base, clientX: 4 });
    fireEvent.pointerMove(board, { ...base, clientX: 5 });
    fireEvent.pointerUp(board, { ...base, clientX: 5 });

    expect(spies.start.mock.calls).toStrictEqual([[3, "right"]]);
    expect(spies.over.mock.calls).toStrictEqual([[4], [5]]);
    expect(spies.tap).not.toHaveBeenCalled();
  });

  it("(T-WEB-S490a) latches on the first cell entered when the press began off the cells", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(<StrokeHarness spies={spies} />);
    stubElementFromPoint(container);
    const board = boardOf(container);
    const base = { clientY: 0, pointerId: 1, pointerType: "mouse", button: 0 };

    fireEvent.pointerDown(board, { ...base, clientX: 99 });
    fireEvent.pointerMove(board, { ...base, clientX: 3 });
    fireEvent.pointerMove(board, { ...base, clientX: 4 });
    fireEvent.pointerUp(board, { ...base, clientX: 4 });

    expect(spies.start.mock.calls).toStrictEqual([[3, "left"]]);
    expect(spies.over.mock.calls).toStrictEqual([[4]]);
  });
});

describe("the board's context menu (T-WEB-S491)", () => {
  it("is prevented on the board and left alone outside it", () => {
    const { container } = render(<StrokeHarness />);
    const board = boardOf(container);
    const outside = container.querySelector<HTMLElement>(
      '[data-testid="outside"]',
    );
    if (outside === null) {
      throw new Error("the harness sibling is missing");
    }

    expect(fireEvent.contextMenu(board)).toBe(false);
    expect(fireEvent.contextMenu(cellAt(container, 3))).toBe(false);
    expect(fireEvent.contextMenu(outside)).toBe(true);
  });
});

describe("a right press keeps the page menu away after the pointer leaves (T-WEB-S503)", () => {
  function outsideOf(container: HTMLElement): HTMLElement {
    const outside = container.querySelector<HTMLElement>(
      '[data-testid="outside"]',
    );
    if (outside === null) {
      throw new Error("the harness sibling is missing");
    }
    return outside;
  }

  const right = { clientY: 0, pointerId: 1, pointerType: "mouse", button: 2 };

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["a painting board", true],
    ["a board that only taps", false],
  ] as const)(
    "prevents the one menu a release outside %s opens, and no later one",
    (_name, painting) => {
      vi.useFakeTimers();
      const { container } = render(<StrokeHarness painting={painting} />);
      stubElementFromPoint(container);
      const board = boardOf(container);
      const outside = outsideOf(container);

      fireEvent.pointerDown(board, { ...right, clientX: 3 });
      fireEvent.pointerUp(painting ? board : window, {
        ...right,
        clientX: 99,
      });

      expect(fireEvent.contextMenu(outside)).toBe(false);
      expect(fireEvent.contextMenu(outside)).toBe(true);
    },
  );

  it("lets the net lapse one task after the stroke ends when no menu came", () => {
    vi.useFakeTimers();
    const { container } = render(<StrokeHarness />);
    stubElementFromPoint(container);
    const board = boardOf(container);

    fireEvent.pointerDown(board, { ...right, clientX: 3 });
    fireEvent.pointerUp(board, { ...right, clientX: 99 });
    vi.advanceTimersByTime(0);

    expect(fireEvent.contextMenu(outsideOf(container))).toBe(true);
  });

  it("does not arm for a left press", () => {
    const { container } = render(<StrokeHarness />);
    stubElementFromPoint(container);
    const board = boardOf(container);
    const left = { ...right, button: 0 };

    fireEvent.pointerDown(board, { ...left, clientX: 3 });
    fireEvent.pointerUp(board, { ...left, clientX: 99 });

    expect(fireEvent.contextMenu(outsideOf(container))).toBe(true);
  });

  it("leaves nothing behind on unmount", () => {
    const { container, unmount } = render(<StrokeHarness />);
    stubElementFromPoint(container);
    const detached = document.createElement("div");
    document.body.append(detached);

    fireEvent.pointerDown(boardOf(container), { ...right, clientX: 3 });
    unmount();

    expect(fireEvent.contextMenu(detached)).toBe(true);
  });
});

describe("a click is consumed once (T-WEB-S504)", () => {
  it("lets a later click with no pointerdown before it through", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(
      <StrokeHarness painting={false} spies={spies} />,
    );
    stubElementFromPoint(container);
    const board = boardOf(container);
    const init = { clientX: 2, clientY: 0, pointerId: 1, pointerType: "touch" };

    fireEvent.pointerDown(board, init);
    fireEvent.pointerUp(board, init);
    fireEvent.click(cellAt(container, 2), { detail: 1 });
    fireEvent.click(cellAt(container, 6), { detail: 1 });

    expect(spies.tap.mock.calls).toStrictEqual([
      [2, "tap"],
      [6, "tap"],
    ]);
  });

  it("consumes the click that follows a drag, then lets the next through", () => {
    const spies = { tap: vi.fn(), start: vi.fn(), over: vi.fn() };
    const { container } = render(<StrokeHarness spies={spies} />);
    stubElementFromPoint(container);
    const board = boardOf(container);
    const init = { clientY: 0, pointerId: 1, pointerType: "touch" };

    fireEvent.pointerDown(board, { ...init, clientX: 1 });
    fireEvent.pointerMove(board, { ...init, clientX: 2 });
    fireEvent.pointerUp(board, { ...init, clientX: 2 });
    fireEvent.click(cellAt(container, 1), { detail: 1 });
    fireEvent.click(cellAt(container, 5), { detail: 1 });

    expect(spies.tap.mock.calls).toStrictEqual([[5, "tap"]]);
  });
});
