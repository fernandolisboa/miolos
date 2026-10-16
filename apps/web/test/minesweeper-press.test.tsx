import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pressOf } from "../src/play/brush";
import { useCellPress } from "../src/play/use-cell-press";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

installPointerStubs();

const CELLS = 9;
const LONG_PRESS = 350;

function Harness({
  spies,
}: {
  readonly spies: {
    readonly activate: (index: number) => void;
    readonly mark: (index: number) => void;
    readonly chord: (index: number) => void;
  };
}) {
  const handlers = useCellPress({
    onActivate: spies.activate,
    onMark: spies.mark,
    onChord: spies.chord,
  });
  return (
    <div data-testid="board" {...handlers}>
      {Array.from({ length: CELLS }, (_unused, index) => (
        <button key={index} type="button" data-cell-index={index} />
      ))}
    </div>
  );
}

function mount() {
  const spies = { activate: vi.fn(), mark: vi.fn(), chord: vi.fn() };
  const { container, getByTestId } = render(<Harness spies={spies} />);
  stubElementFromPoint(container);
  return { spies, board: getByTestId("board") };
}

const MOUSE = { pointerId: 1, pointerType: "mouse" } as const;
const TOUCH = { pointerId: 1, pointerType: "touch" } as const;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("a cell press is read from the button and the pointer, not guessed (T-WEB-S884)", () => {
  it("ignores buttons that are neither primary, middle nor secondary", () => {
    const { spies, board } = mount();

    for (const button of [3, 4]) {
      fireEvent.pointerDown(board, { ...MOUSE, clientX: 2, button });
      fireEvent.pointerUp(board, { ...MOUSE, clientX: 2, button });
    }

    expect(spies.activate).not.toHaveBeenCalled();
    expect(spies.chord).not.toHaveBeenCalled();
    expect(spies.mark).not.toHaveBeenCalled();
  });

  it("leaves the stroke games' rule as it was: right is right, a middle is nothing", () => {
    expect(pressOf({ button: 2, pointerType: "mouse" })).toBe("right");
    expect(pressOf({ button: 1, pointerType: "mouse" })).toBeNull();
    expect(pressOf({ button: 0, pointerType: "mouse" })).toBe("left");
    expect(pressOf({ button: 0, pointerType: "touch" })).toBe("tap");
  });

  it("opens the cell under a left click when the button is released, not when it goes down", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...MOUSE, clientX: 4, button: 0 });
    expect(spies.activate).not.toHaveBeenCalled();
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 5, button: 0 });

    expect(spies.activate.mock.calls).toStrictEqual([[5]]);
    expect(spies.mark).not.toHaveBeenCalled();
  });

  it("does nothing when the click is released off the board", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...MOUSE, clientX: 4, button: 0 });
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 99, button: 0 });

    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("marks on a right click as it goes down, and blocks the page menu", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...MOUSE, clientX: 2, button: 2 });
    expect(spies.mark.mock.calls).toStrictEqual([[2]]);
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 2, button: 2 });
    const menu = fireEvent.contextMenu(board);

    expect(menu).toBe(false);
    expect(spies.mark).toHaveBeenCalledTimes(1);
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("chords on a middle click when it is released", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...MOUSE, clientX: 6, button: 1 });
    expect(spies.chord).not.toHaveBeenCalled();
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 6, button: 1 });

    expect(spies.chord.mock.calls).toStrictEqual([[6]]);
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("chords, and does not open, when the second button joins mid-press", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 3,
      button: 0,
      buttons: 1,
    });
    fireEvent.pointerMove(board, {
      ...MOUSE,
      clientX: 3,
      button: -1,
      buttons: 3,
    });
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 3, button: 0, buttons: 0 });

    expect(spies.chord.mock.calls).toStrictEqual([[3]]);
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("chords when both buttons go down together", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 1,
      button: 0,
      buttons: 3,
    });
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 1, button: 0, buttons: 0 });

    expect(spies.chord.mock.calls).toStrictEqual([[1]]);
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("opens on a quick tap and never marks", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...TOUCH, clientX: 7, button: 0 });
    vi.advanceTimersByTime(LONG_PRESS - 1);
    fireEvent.pointerUp(board, { ...TOUCH, clientX: 7, button: 0 });
    vi.advanceTimersByTime(1000);

    expect(spies.activate.mock.calls).toStrictEqual([[7]]);
    expect(spies.mark).not.toHaveBeenCalled();
  });

  it("marks on a long press, once, and the release opens nothing", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...TOUCH, clientX: 7, button: 0 });
    vi.advanceTimersByTime(LONG_PRESS);
    expect(spies.mark.mock.calls).toStrictEqual([[7]]);
    fireEvent.pointerUp(board, { ...TOUCH, clientX: 7, button: 0 });

    expect(spies.mark).toHaveBeenCalledTimes(1);
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("gives up when the finger moves, so a swipe along the board marks nothing", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, {
      ...TOUCH,
      clientX: 2,
      clientY: 0,
      button: 0,
    });
    fireEvent.pointerMove(board, {
      ...TOUCH,
      clientX: 2,
      clientY: 40,
      button: 0,
    });
    vi.advanceTimersByTime(LONG_PRESS * 2);
    fireEvent.pointerUp(board, { ...TOUCH, clientX: 2, clientY: 40 });

    expect(spies.mark).not.toHaveBeenCalled();
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("gives up on pointercancel, the browser's sign that it took the touch to scroll", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...TOUCH, clientX: 2, button: 0 });
    fireEvent.pointerCancel(board, { ...TOUCH, clientX: 2 });
    vi.advanceTimersByTime(LONG_PRESS * 2);
    fireEvent.pointerUp(board, { ...TOUCH, clientX: 2 });

    expect(spies.mark).not.toHaveBeenCalled();
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("refuses the page's autoscroll on a middle press, and nothing else", () => {
    const { board } = mount();

    expect(
      fireEvent.pointerDown(board, { ...MOUSE, clientX: 6, button: 1 }),
    ).toBe(false);
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 6, button: 1 });
    expect(
      fireEvent.pointerDown(board, { ...MOUSE, clientX: 6, button: 0 }),
    ).toBe(true);
  });

  it("lets a new press from the same pointer replace one whose release was lost", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...MOUSE, clientX: 1, button: 2 });
    fireEvent.pointerDown(board, { ...MOUSE, clientX: 4, button: 0 });
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 4, button: 0 });

    expect(spies.activate.mock.calls).toStrictEqual([[4]]);
  });

  it("lets a new primary pointer replace a press whose pointer never reported its release", () => {
    const { spies, board } = mount();
    const stale = { pointerId: 5, pointerType: "touch", isPrimary: true };
    const fresh = { pointerId: 6, pointerType: "touch", isPrimary: true };

    fireEvent.pointerDown(board, { ...stale, clientX: 1, button: 0 });
    fireEvent.pointerDown(board, { ...fresh, clientX: 4, button: 0 });
    fireEvent.pointerUp(board, { ...fresh, clientX: 4, button: 0 });

    expect(spies.activate.mock.calls).toStrictEqual([[4]]);
  });

  it("gives up when the pointer capture is lost before the release", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...TOUCH, clientX: 2, button: 0 });
    fireEvent.lostPointerCapture(board, { ...TOUCH });
    vi.advanceTimersByTime(LONG_PRESS * 2);
    fireEvent.pointerUp(board, { ...TOUCH, clientX: 2 });

    expect(spies.mark).not.toHaveBeenCalled();
    expect(spies.activate).not.toHaveBeenCalled();
  });

  it("follows one pointer at a time", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...MOUSE, clientX: 1, button: 0 });
    fireEvent.pointerDown(board, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 8,
      button: 0,
    });
    fireEvent.pointerUp(board, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 8,
    });
    expect(spies.activate).not.toHaveBeenCalled();

    fireEvent.pointerUp(board, { ...MOUSE, clientX: 1, button: 0 });
    expect(spies.activate.mock.calls).toStrictEqual([[1]]);
  });
});
