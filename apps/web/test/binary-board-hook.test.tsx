import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBinaryBoard } from "../src/play/use-binary-board";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

installPointerStubs();

afterEach(() => {
  vi.restoreAllMocks();
});

type Keys = NonNullable<Parameters<typeof useBinaryBoard>[0]["keys"]>;

function Harness({
  painting,
  keys,
  log,
}: {
  readonly painting?: boolean;
  readonly keys?: Keys;
  readonly log: string[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const board = useBinaryBoard({
    size: 3,
    selected,
    onTap: (index) => log.push(`tap ${index}`),
    onStrokeStart: (index) => log.push(`start ${index}`),
    onPaintOver: (index) => log.push(`over ${index}`),
    onMove: (rows, columns) => log.push(`move ${rows},${columns}`),
    onEnterValue: (value) => log.push(`enter ${value}`),
    onClear: () => log.push("clear"),
    ...(painting === undefined ? {} : { painting }),
    ...(keys === undefined ? {} : { keys }),
  });
  return (
    <div data-testid="board" {...board.boardProps}>
      {Array.from({ length: 9 }, (_unused, index) => (
        <button
          key={index}
          type="button"
          data-cell-index={index}
          tabIndex={board.tabbable === index ? 0 : -1}
          onFocus={() => setSelected(index)}
          onClick={(event) => board.onCellClick(index, event)}
        />
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

function typed(container: HTMLElement, keys: readonly string[]): void {
  const cell = container.querySelector<HTMLElement>('[data-cell-index="4"]');
  if (cell === null) {
    throw new Error("the harness cell is missing");
  }
  for (const key of keys) {
    fireEvent.keyDown(cell, { key });
  }
}

describe("useBinaryBoard's painting and keys inputs (T-WEB-S994)", () => {
  it("keeps the Nonogram key table by default: 1 fills, 2 marks, 0 Backspace Delete clear", () => {
    const log: string[] = [];
    const { container } = render(<Harness log={log} />);

    typed(container, ["1", "2", "0", "Backspace", "Delete", "3", "a"]);

    expect(log).toEqual(["enter 1", "enter 0", "clear", "clear", "clear"]);
  });

  it("takes another key table whole: no default key survives", () => {
    const log: string[] = [];
    const keys: Keys = new Map([
      ["0", 0],
      ["1", 1],
      ["Backspace", null],
    ]);
    const { container } = render(<Harness log={log} keys={keys} />);

    typed(container, ["0", "1", "2", "Backspace", "Delete"]);

    expect(log).toEqual(["enter 0", "enter 1", "clear"]);
  });

  it("captures the pointer by default and never when painting is false", () => {
    const capture = vi.spyOn(Element.prototype, "setPointerCapture");
    const painting = render(<Harness log={[]} />);
    fireEvent.pointerDown(boardOf(painting.container), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    expect(capture).toHaveBeenCalledTimes(1);
    painting.unmount();

    capture.mockClear();
    const cycling = render(<Harness log={[]} painting={false} />);
    fireEvent.pointerDown(boardOf(cycling.container), {
      clientX: 0,
      clientY: 0,
      pointerId: 1,
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it("with painting false, a press taps once and still focuses the cell it ended on", () => {
    const log: string[] = [];
    const { container } = render(<Harness log={log} painting={false} />);
    stubElementFromPoint(container);
    const board = boardOf(container);
    const at = { clientX: 5, clientY: 0, pointerId: 1 };

    fireEvent.pointerDown(board, at);
    fireEvent.pointerMove(board, { ...at, clientX: 6 });
    fireEvent.pointerUp(board, at);
    const cell = container.querySelector('[data-cell-index="5"]');
    fireEvent.click(cell as Element, { detail: 1 });

    expect(log).toEqual(["tap 5"]);
    expect(document.activeElement).toBe(cell);
    expect(cell).toHaveAttribute("tabindex", "0");
  });
});
