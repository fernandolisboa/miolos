import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pressOf, type Press } from "../src/play/brush";
import { useCellPress } from "../src/play/use-cell-press";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

installPointerStubs();

const CELLS = 9;
const LONG_PRESS = 350;

function Harness({
  spies,
}: {
  readonly spies: {
    readonly activate: (index: number, press: Press) => void;
    readonly mark: (index: number) => void;
    readonly chord: (index: number) => void;
  };
}) {
  const { handlers, held } = useCellPress({
    onActivate: spies.activate,
    onMark: spies.mark,
    onChord: spies.chord,
  });
  return (
    <div
      data-testid="board"
      data-held={
        held === null ? "" : `${String(held.index)}${held.chord ? "+" : ""}`
      }
      {...handlers}
    >
      {Array.from({ length: CELLS }, (_unused, index) => (
        <button key={index} type="button" data-cell-index={index} />
      ))}
    </div>
  );
}

function mount() {
  const spies = { activate: vi.fn(), mark: vi.fn(), chord: vi.fn() };
  const { container, getByTestId, unmount } = render(<Harness spies={spies} />);
  stubElementFromPoint(container);
  return { spies, board: getByTestId("board"), unmount };
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

    expect(spies.activate.mock.calls).toStrictEqual([[5, "left"]]);
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

    expect(spies.activate.mock.calls).toStrictEqual([[7, "tap"]]);
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

    expect(spies.activate.mock.calls).toStrictEqual([[4, "left"]]);
  });

  it("lets a new primary pointer replace a press whose pointer never reported its release", () => {
    const { spies, board } = mount();
    const stale = { pointerId: 5, pointerType: "touch", isPrimary: true };
    const fresh = { pointerId: 6, pointerType: "touch", isPrimary: true };

    fireEvent.pointerDown(board, { ...stale, clientX: 1, button: 0 });
    fireEvent.pointerDown(board, { ...fresh, clientX: 4, button: 0 });
    fireEvent.pointerUp(board, { ...fresh, clientX: 4, button: 0 });

    expect(spies.activate.mock.calls).toStrictEqual([[4, "tap"]]);
  });

  it("keeps a pen press when a palm touches down beside it", () => {
    const { spies, board } = mount();
    const pen = { pointerId: 5, pointerType: "pen", isPrimary: true };
    const palm = { pointerId: 6, pointerType: "touch", isPrimary: true };

    fireEvent.pointerDown(board, { ...pen, clientX: 1, button: 0 });
    fireEvent.pointerDown(board, { ...palm, clientX: 4, button: 0 });
    fireEvent.pointerUp(board, { ...pen, clientX: 1, button: 0 });

    expect(spies.activate.mock.calls).toStrictEqual([[1, "tap"]]);
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
    expect(spies.activate.mock.calls).toStrictEqual([[1, "left"]]);
  });
});

describe("both buttons chord the way Windows does (T-WEB-S940)", () => {
  const down = (buttons: number) => ({ ...MOUSE, clientX: 3, buttons });

  it.each([
    ["left first, left released first", 0, 2, 0],
    ["left first, right released first", 0, 2, 2],
    ["right first, right released first", 2, 0, 2],
    ["right first, left released first", 2, 0, 0],
  ] as const)(
    "%s: the first release chords once, and the second does nothing",
    (_name, first, second, released) => {
      const { spies, board } = mount();
      const left = released === 0 ? 2 : 1;

      fireEvent.pointerDown(board, {
        ...down(first === 0 ? 1 : 2),
        button: first,
      });
      fireEvent.pointerMove(board, { ...down(3), button: second });
      expect(spies.chord).not.toHaveBeenCalled();
      fireEvent.pointerMove(board, { ...down(left), button: released });
      expect(spies.chord.mock.calls).toStrictEqual([[3]]);
      fireEvent.pointerMove(board, { ...MOUSE, clientX: 5, buttons: left });
      fireEvent.pointerUp(board, {
        ...down(0),
        button: released === 0 ? 2 : 0,
      });
      fireEvent.click(board, { detail: 1 });

      expect(spies.chord).toHaveBeenCalledTimes(1);
      expect(spies.activate).not.toHaveBeenCalled();
      expect(spies.mark.mock.calls).toStrictEqual(first === 2 ? [[3]] : []);
    },
  );

  it("chords at the cell under the pointer when the first button comes up", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, { ...down(1), button: 0 });
    fireEvent.pointerMove(board, { ...down(3), button: 2 });
    fireEvent.pointerMove(board, {
      ...MOUSE,
      clientX: 4,
      buttons: 1,
      button: 2,
    });
    fireEvent.pointerMove(board, { ...MOUSE, clientX: 6, buttons: 1 });
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 8, buttons: 0, button: 0 });

    expect(spies.chord.mock.calls).toStrictEqual([[4]]);
  });
  it("lets a pen chord with its barrel button however long it is held", () => {
    const { spies, board } = mount();
    const pen = { pointerId: 5, pointerType: "pen", clientX: 3 } as const;

    fireEvent.pointerDown(board, { ...pen, button: 0, buttons: 1 });
    fireEvent.pointerMove(board, { ...pen, button: 2, buttons: 3 });
    vi.advanceTimersByTime(LONG_PRESS * 2);
    fireEvent.pointerMove(board, { ...pen, button: 2, buttons: 1 });

    expect(spies.chord.mock.calls).toStrictEqual([[3]]);
    expect(spies.mark).not.toHaveBeenCalled();
  });
});

describe("the press names the cell a release would act on, and whether it chords (T-WEB-S941)", () => {
  const held = (board: HTMLElement) => board.dataset.held;

  it("holds the cell under a left press alone and a middle press as a chord, follows the pointer, and lets go on release", () => {
    const { board } = mount();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 2,
      button: 0,
      buttons: 1,
    });
    expect(held(board)).toBe("2");
    fireEvent.pointerMove(board, { ...MOUSE, clientX: 5, buttons: 1 });
    expect(held(board)).toBe("5");
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 5, button: 0, buttons: 0 });
    expect(held(board)).toBe("");

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 6,
      button: 1,
      buttons: 4,
    });
    expect(held(board)).toBe("6+");
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 6, button: 1, buttons: 0 });
    expect(held(board)).toBe("");
  });

  it("holds nothing for a right press alone, a chord once the left joins it, and nothing after the first release", () => {
    const { board } = mount();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 2,
      button: 2,
      buttons: 2,
    });
    expect(held(board)).toBe("");
    fireEvent.pointerMove(board, {
      ...MOUSE,
      clientX: 2,
      button: 0,
      buttons: 3,
    });
    expect(held(board)).toBe("2+");
    fireEvent.pointerMove(board, {
      ...MOUSE,
      clientX: 2,
      button: 2,
      buttons: 1,
    });
    expect(held(board)).toBe("");
  });

  it("turns a left press into a chord when the right button joins it", () => {
    const { board } = mount();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 4,
      button: 0,
      buttons: 1,
    });
    expect(held(board)).toBe("4");
    fireEvent.pointerMove(board, {
      ...MOUSE,
      clientX: 4,
      button: 2,
      buttons: 3,
    });
    expect(held(board)).toBe("4+");
  });

  it("holds a Shift+left press as a chord, and its release chords, as Windows does for one-button mice", () => {
    const { spies, board } = mount();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 4,
      button: 0,
      buttons: 1,
      shiftKey: true,
    });
    expect(held(board)).toBe("4+");
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 4, button: 0, buttons: 0 });

    expect(spies.chord.mock.calls).toStrictEqual([[4]]);
    expect(spies.activate).not.toHaveBeenCalled();

    fireEvent.pointerDown(board, {
      ...TOUCH,
      clientX: 5,
      button: 0,
      shiftKey: true,
    });
    expect(held(board)).toBe("5");
  });

  it("lets go when a long press turns into a flag", () => {
    const { board } = mount();

    fireEvent.pointerDown(board, { ...TOUCH, clientX: 7, button: 0 });
    expect(held(board)).toBe("7");
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS);
    });
    expect(held(board)).toBe("");
  });
});

describe("a press with the right button keeps the page menu away (T-WEB-S942)", () => {
  function outside(): HTMLElement {
    const element = document.createElement("div");
    document.body.append(element);
    return element;
  }

  it.each([
    ["a right press", [{ button: 2, buttons: 2 }]],
    [
      "a right button joining a left press",
      [
        { button: 0, buttons: 1 },
        { button: 2, buttons: 3 },
      ],
    ],
  ] as const)(
    "takes the one menu Windows opens after %s ends the board, and no later one",
    (_name, presses) => {
      const { board, unmount } = mount();
      const elsewhere = outside();

      const [first, ...joins] = presses;
      fireEvent.pointerDown(board, { ...MOUSE, clientX: 3, ...first });
      for (const join of joins) {
        fireEvent.pointerMove(board, { ...MOUSE, clientX: 3, ...join });
      }
      unmount();
      fireEvent.pointerUp(window, { ...MOUSE, clientX: 3, buttons: 0 });

      expect(fireEvent.contextMenu(elsewhere)).toBe(false);
      expect(fireEvent.contextMenu(elsewhere)).toBe(true);
    },
  );

  it("lapses one task after a pointercancel too", () => {
    const { board } = mount();
    const elsewhere = outside();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 3,
      button: 2,
      buttons: 2,
    });
    fireEvent.pointerCancel(window, { ...MOUSE });
    vi.advanceTimersByTime(0);

    expect(fireEvent.contextMenu(elsewhere)).toBe(true);
  });

  it("lapses one task after the release when no menu came, and never arms for a left press", () => {
    const { board } = mount();
    const elsewhere = outside();

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 3,
      button: 2,
      buttons: 2,
    });
    fireEvent.pointerUp(board, { ...MOUSE, clientX: 3, button: 2, buttons: 0 });
    vi.advanceTimersByTime(0);
    expect(fireEvent.contextMenu(elsewhere)).toBe(true);

    fireEvent.pointerDown(board, {
      ...MOUSE,
      clientX: 3,
      button: 0,
      buttons: 1,
    });
    expect(fireEvent.contextMenu(elsewhere)).toBe(true);
  });
});
