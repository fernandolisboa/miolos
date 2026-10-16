import { deriveClues } from "@miolos/games/nonogram";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Board } from "../src/nonogram/board";
import type { NonogramCellValue } from "../src/nonogram/state";
import {
  cellsAfter,
  projectOnLine,
  strokeAxis,
} from "../src/play/straight-stroke";
import { NO_MISTAKES } from "../src/play/mistakes";
import { installPointerStubs } from "./pointer";

installPointerStubs();

const SIZE = 5;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("a straight stroke's axis, projection and fill (T-WEB-S655)", () => {
  it("takes the axis of the first cell entered, or the larger travel on a diagonal", () => {
    expect(strokeAxis(SIZE, 12, 13, { x: 1, y: 9 })).toBe("row");
    expect(strokeAxis(SIZE, 12, 11, { x: -1, y: 0 })).toBe("row");
    expect(strokeAxis(SIZE, 12, 17, { x: 9, y: 1 })).toBe("column");
    expect(strokeAxis(SIZE, 12, 7, { x: 0, y: -1 })).toBe("column");
    expect(strokeAxis(SIZE, 12, 18, { x: 30, y: 20 })).toBe("row");
    expect(strokeAxis(SIZE, 12, 6, { x: -20, y: -30 })).toBe("column");
    expect(strokeAxis(SIZE, 12, 18, { x: 25, y: 25 })).toBe("row");
  });

  it("projects any cell onto the start's row or column", () => {
    expect(projectOnLine(SIZE, 12, "row", 19)).toBe(14);
    expect(projectOnLine(SIZE, 12, "row", 0)).toBe(10);
    expect(projectOnLine(SIZE, 12, "column", 19)).toBe(17);
    expect(projectOnLine(SIZE, 12, "column", 0)).toBe(2);
  });

  it("lists every cell after the last one up to the target, in either direction", () => {
    expect(cellsAfter(SIZE, "row", 10, 14)).toEqual([11, 12, 13, 14]);
    expect(cellsAfter(SIZE, "row", 14, 12)).toEqual([13, 12]);
    expect(cellsAfter(SIZE, "column", 2, 22)).toEqual([7, 12, 17, 22]);
    expect(cellsAfter(SIZE, "column", 17, 7)).toEqual([12, 7]);
    expect(cellsAfter(SIZE, "row", 12, 12)).toEqual([]);
  });
});

const CLUES = deriveClues(
  Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(true)),
);
const EMPTY: readonly NonogramCellValue[] = new Array<NonogramCellValue>(
  SIZE * SIZE,
).fill(null);

function renderBoard(straightDrag: boolean) {
  window.localStorage.setItem(
    "miolos-settings",
    JSON.stringify({ games: { nonogram: { straightDrag } } }),
  );
  const spies = { start: vi.fn(), over: vi.fn() };
  const { container } = render(
    <Board
      size={SIZE}
      clues={CLUES}
      solution={null}
      entries={EMPTY}
      mistakes={NO_MISTAKES}
      selected={null}
      hintIndex={null}
      spotlight={[]}
      onSelect={vi.fn()}
      onMove={vi.fn()}
      onMarkCell={vi.fn()}
      onStrokeStart={spies.start}
      onEnterValue={vi.fn()}
      onClear={vi.fn()}
      onPaintOver={spies.over}
    />,
  );
  vi.spyOn(document, "elementFromPoint").mockImplementation((x, y) =>
    container.querySelector(
      `[data-cell-index="${String(Math.floor(y) * SIZE + Math.floor(x))}"]`,
    ),
  );
  const board = container.querySelector<HTMLElement>("[role=group]");
  if (board === null) {
    throw new Error("no board");
  }
  const at = (x: number, y: number) => ({
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    button: 0,
  });
  const drag = (...points: readonly (readonly [number, number])[]) => {
    const [first, ...rest] = points;
    if (first === undefined) {
      return;
    }
    fireEvent.pointerDown(board, at(...first));
    for (const point of rest) {
      fireEvent.pointerMove(board, at(...point));
    }
    const last = rest.at(-1) ?? first;
    fireEvent.pointerUp(board, at(...last));
  };
  return { spies, drag };
}

const painted = (over: ReturnType<typeof vi.fn>) =>
  over.mock.calls.map(([index]) => index as number);

describe("Arrastar só em linha reta keeps a Nonogram stroke on one line (T-WEB-S656)", () => {
  it("holds the row while the pointer wanders into the next one", () => {
    const { spies, drag } = renderBoard(true);
    drag([0.5, 0.5], [1.5, 0.5], [2.5, 1.4], [3.5, 1.6]);

    expect(spies.start.mock.calls).toStrictEqual([[0, "left"]]);
    expect(painted(spies.over)).toEqual([1, 2, 3]);
  });

  it("holds the column, and fills the cells a fast move jumps over", () => {
    const { spies, drag } = renderBoard(true);
    drag([2.5, 0.5], [2.5, 1.5], [3.5, 4.5], [2.5, 2.5]);

    expect(painted(spies.over)).toEqual([7, 12, 17, 22, 17, 12]);
  });

  it("picks the axis with the larger travel when the first move is diagonal", () => {
    const row = renderBoard(true);
    row.drag([0.9, 0.6], [1.8, 1.1]);
    expect(painted(row.spies.over)).toEqual([1]);

    const column = renderBoard(true);
    column.drag([0.6, 0.9], [1.1, 1.8], [1.4, 3.5]);
    expect(painted(column.spies.over)).toEqual([5, 10, 15]);
  });

  it("latches on the first cell entered when the press began off the cells, and settles focus on the line", () => {
    const { spies, drag } = renderBoard(true);
    drag([2.5, -1], [0.5, 2.5], [1.5, 3.2], [3.5, 3.9]);

    expect(spies.start.mock.calls).toStrictEqual([[10, "left"]]);
    expect(painted(spies.over)).toEqual([11, 12, 13]);
    expect(document.activeElement).toHaveAttribute("data-cell-index", "13");
  });

  it("paints every cell the pointer enters when the setting is off, the default", () => {
    const { spies, drag } = renderBoard(false);
    drag([0.5, 0.5], [1.5, 0.5], [2.5, 1.4]);

    expect(painted(spies.over)).toEqual([1, 7]);
  });
});
