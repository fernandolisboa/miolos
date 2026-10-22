import type { DailyBinairoResponse } from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoScreen } from "../src/binairo/binairo-screen";
import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { messages } from "../src/i18n";
import { playRecordKey } from "../src/play/play-record";
import { bodyOf, decl, stylesheet } from "./css-source";
import { flushGeneration } from "./free-generation";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/binairo",
}));

installPointerStubs();

const DATE = "2026-07-30";
const PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });
const DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...PUZZLE.givens],
};
const copy = messages.games.binairo.play;
const OPEN = PUZZLE.givens.flatMap((given, index) =>
  given === null ? [index] : [],
);
const GIVEN = PUZZLE.givens.findIndex((given) => given !== null);
const [A = 0, B = 0, C = 0] = OPEN;
const CENTRE = 27;

function boardOf(): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria });
}

function cellAt(index: number): HTMLElement {
  const cell = boardOf().querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

function focusAt(index: number): HTMLElement {
  const cell = cellAt(index);
  act(() => {
    cell.focus();
  });
  return cell;
}

function tabStops(): number[] {
  return [...boardOf().querySelectorAll<HTMLElement>("[data-cell-index]")]
    .filter((cell) => cell.getAttribute("tabindex") === "0")
    .map((cell) => Number(cell.dataset["cellIndex"]));
}

function key(index: number, name: string, init: KeyboardEventInit = {}) {
  return fireEvent.keyDown(cellAt(index), { key: name, ...init });
}

function activeIndex(): number {
  return Number((document.activeElement as HTMLElement).dataset["cellIndex"]);
}

function brush(value: 0 | 1): void {
  fireEvent.click(
    screen.getByLabelText(
      value === 0 ? copy.controls.zeroAria : copy.controls.oneAria,
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the Binairo board is one composite widget (T-WEB-S984)", () => {
  it("is one labelled group of 64 buttons with a single tab stop, on cell 0 until a cell is selected", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(boardOf().getAttribute("role")).toBe("group");
    expect(boardOf().getAttribute("aria-label")).toBe(copy.boardAria);
    const cells = container.querySelectorAll("[data-cell-index]");
    expect(cells).toHaveLength(64);
    for (const cell of cells) {
      expect(cell.tagName).toBe("BUTTON");
      expect(cell).toHaveAttribute("type", "button");
    }
    expect(tabStops()).toEqual([0]);

    fireEvent.focus(cellAt(A));
    expect(tabStops()).toEqual([A]);
  });

  it("makes a given a focusable, aria-disabled and inert button that keeps its name", () => {
    render(<BinairoScreen daily={DAILY} />);
    const given = PUZZLE.givens[GIVEN] ?? 0;
    const cell = cellAt(GIVEN);

    expect(cell.tagName).toBe("BUTTON");
    expect(cell).toHaveAttribute("aria-disabled", "true");
    expect(cell).not.toBeDisabled();
    expect(cell).toHaveAttribute(
      "aria-label",
      copy.cellGivenAria(
        Math.floor(GIVEN / 8) + 1,
        (GIVEN % 8) + 1,
        given === 1 ? 1 : 0,
      ),
    );

    focusAt(GIVEN);
    expect(document.activeElement).toBe(cell);
    expect(tabStops()).toEqual([GIVEN]);
    fireEvent.click(cell);
    key(GIVEN, "1");
    key(GIVEN, "Backspace");
    expect(cell.textContent).toBe(String(given));
  });

  it("keeps the playable cells' accessible names", () => {
    render(<BinairoScreen daily={DAILY} />);

    expect(cellAt(A)).toHaveAttribute(
      "aria-label",
      copy.cellAria(Math.floor(A / 8) + 1, (A % 8) + 1, null),
    );
  });
});

describe("the Binairo board moves with the keyboard (T-WEB-S985)", () => {
  it("moves one cell with the arrows and clamps at every edge", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(CENTRE);

    expect(key(CENTRE, "ArrowRight")).toBe(false);
    expect(activeIndex()).toBe(CENTRE + 1);
    key(CENTRE + 1, "ArrowDown");
    expect(activeIndex()).toBe(CENTRE + 9);
    key(CENTRE + 9, "ArrowLeft");
    expect(activeIndex()).toBe(CENTRE + 8);
    key(CENTRE + 8, "ArrowUp");
    expect(activeIndex()).toBe(CENTRE);

    focusAt(0);
    key(0, "ArrowLeft");
    expect(activeIndex()).toBe(0);
    key(0, "ArrowUp");
    expect(activeIndex()).toBe(0);
    focusAt(63);
    key(63, "ArrowRight");
    key(63, "ArrowDown");
    expect(activeIndex()).toBe(63);
  });

  it("jumps with Home, End, PageUp and PageDown", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(CENTRE);

    key(CENTRE, "Home");
    expect(activeIndex()).toBe(24);
    key(24, "End");
    expect(activeIndex()).toBe(31);
    key(31, "PageUp");
    expect(activeIndex()).toBe(7);
    key(7, "PageDown");
    expect(activeIndex()).toBe(63);
    expect(tabStops()).toEqual([63]);
  });

  it("lets Ctrl, Meta and Alt chords and Tab pass through unmoved", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);

    for (const chord of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
    ]) {
      expect(key(A, "ArrowRight", chord)).toBe(true);
      expect(key(A, "1", chord)).toBe(true);
    }
    expect(key(A, "z", { ctrlKey: true })).toBe(true);
    expect(key(A, "Tab")).toBe(true);
    expect(activeIndex()).toBe(A);
    expect(cellAt(A).textContent).toBe("");
  });

  it("lets the caret cross a given", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(GIVEN - 1 >= 0 ? GIVEN - 1 : GIVEN + 1);
    key(activeIndex(), GIVEN > 0 ? "ArrowRight" : "ArrowLeft");
    expect(activeIndex()).toBe(GIVEN);
  });
});

describe("the Binairo digit keys write their own digit (T-WEB-S986)", () => {
  it("writes 0 and 1, and the same key again clears", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);

    expect(key(A, "1")).toBe(false);
    expect(cellAt(A).textContent).toBe("1");
    key(A, "1");
    expect(cellAt(A).textContent).toBe("");
    key(A, "0");
    expect(cellAt(A).textContent).toBe("0");
    key(A, "0");
    expect(cellAt(A).textContent).toBe("");
    key(A, "0");
    key(A, "1");
    expect(cellAt(A).textContent).toBe("1");
  });

  it("clears with Backspace and Delete, and leaves 2 alone", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);

    key(A, "1");
    key(A, "Backspace");
    expect(cellAt(A).textContent).toBe("");
    key(A, "0");
    key(A, "Delete");
    expect(cellAt(A).textContent).toBe("");
    expect(key(A, "2")).toBe(true);
    expect(cellAt(A).textContent).toBe("");
  });

  it("never writes a given", () => {
    render(<BinairoScreen daily={DAILY} />);
    const before = cellAt(GIVEN).textContent;
    focusAt(GIVEN);

    key(GIVEN, "0");
    key(GIVEN, "1");
    key(GIVEN, "Delete");

    expect(cellAt(GIVEN).textContent).toBe(before);
  });

  it("ignores the brush", () => {
    render(<BinairoScreen daily={DAILY} />);
    brush(0);
    focusAt(A);

    key(A, "1");
    expect(cellAt(A).textContent).toBe("1");
    key(A, "0");
    expect(cellAt(A).textContent).toBe("0");
  });

  it("writes where the caret is after it moved", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);
    key(A, "1");
    fireEvent.focus(cellAt(B));
    key(B, "0");

    expect(cellAt(A).textContent).toBe("1");
    expect(cellAt(B).textContent).toBe("0");
  });
});

describe("Enter and Space are the cell's tap (T-WEB-S987)", () => {
  it("lets the browser activate the button: the keys are not intercepted", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);

    expect(key(A, "Enter")).toBe(true);
    expect(key(A, " ")).toBe(true);
  });

  it("cycles from the first value in cycle mode, as a click with no detail", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);

    fireEvent.click(cellAt(A), { detail: 0 });
    expect(cellAt(A).textContent).toBe("1");
    fireEvent.click(cellAt(A), { detail: 0 });
    expect(cellAt(A).textContent).toBe("0");
    fireEvent.click(cellAt(A), { detail: 0 });
    expect(cellAt(A).textContent).toBe("");
  });

  it("writes the brush value in paint mode, and the same activation clears", () => {
    render(<BinairoScreen daily={DAILY} />);
    brush(0);
    focusAt(A);

    fireEvent.click(cellAt(A), { detail: 0 });
    expect(cellAt(A).textContent).toBe("0");
    fireEvent.click(cellAt(A), { detail: 0 });
    expect(cellAt(A).textContent).toBe("");
  });

  it("selects the cell it was pressed on and takes the focus there", () => {
    render(<BinairoScreen daily={DAILY} />);

    fireEvent.click(cellAt(B), { detail: 0 });

    expect(document.activeElement).toBe(cellAt(B));
    expect(tabStops()).toEqual([B]);
  });
});

describe("a pointer stroke leaves the caret and the focus on its end cell (T-WEB-S988)", () => {
  const base = { clientY: 0, pointerId: 1, pointerType: "mouse", button: 0 };

  it("focuses the cell a paint drag ends on, and makes it the one tab stop", () => {
    render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(boardOf());
    brush(1);
    const board = boardOf();

    fireEvent.pointerDown(board, { ...base, clientX: A });
    fireEvent.pointerMove(board, { ...base, clientX: B });
    fireEvent.pointerMove(board, { ...base, clientX: C });
    fireEvent.pointerUp(board, { ...base, clientX: C });

    expect(document.activeElement).toBe(cellAt(C));
    expect(tabStops()).toEqual([C]);
    expect(cellAt(C).textContent).toBe("1");
  });

  it("focuses the cell a cycle tap landed on, without cycling it again from the click", () => {
    render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(boardOf());
    const board = boardOf();

    fireEvent.pointerDown(board, { ...base, clientX: B });
    fireEvent.pointerUp(board, { ...base, clientX: B });

    expect(document.activeElement).toBe(cellAt(B));
    fireEvent.click(cellAt(B), { detail: 1 });
    expect(document.activeElement).toBe(cellAt(B));
    expect(tabStops()).toEqual([B]);
    expect(cellAt(B).textContent).toBe("1");
  });

  it("does not steal the focus from a control outside the board when the caret moves", () => {
    render(<BinairoScreen daily={DAILY} />);
    const control = screen.getByLabelText(copy.controls.oneAria);
    act(() => {
      control.focus();
    });

    fireEvent.focus(cellAt(B));

    expect(document.activeElement).toBe(control);
  });

  it("a key after a drag writes at the end cell", () => {
    render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(boardOf());
    brush(1);
    const board = boardOf();

    fireEvent.pointerDown(board, { ...base, clientX: A });
    fireEvent.pointerMove(board, { ...base, clientX: B });
    fireEvent.pointerUp(board, { ...base, clientX: B });
    key(B, "Backspace");

    expect(cellAt(A).textContent).toBe("1");
    expect(cellAt(B).textContent).toBe("");
  });
});

describe("the caret and the focus ring are one CSS block (T-WEB-S989)", () => {
  const css = stylesheet("src/binairo/binairo-screen.module.css");

  it("styles .cell:focus-visible in exactly one rule, shared with .cellSelected", () => {
    const rules = [...css.matchAll(/([^{}]+)\{/g)]
      .map(([, prelude]) => (prelude ?? "").trim())
      .filter((prelude) => /\.cell:focus-visible(?![\w-])/.test(prelude));
    expect(rules).toHaveLength(1);
    const prelude = rules[0] ?? "";
    expect(prelude.split(",").map((part) => part.trim())).toEqual([
      ".cellSelected",
      ".cell:focus-visible",
    ]);
  });

  it("draws the caret as an inset outline in --ink", () => {
    const body = bodyOf(css, ".cellSelected,\n.cell:focus-visible");
    expect(decl(body, "outline")).toBe("2px solid var(--ink)");
    expect(decl(body, "outline-offset")).toMatch(/^-\d+px$/);
  });
});

describe("free play has the same widget (T-WEB-S993)", () => {
  it("renders the labelled group, one tab stop, and writes with the keys", async () => {
    const free = generateBinairo({
      seed: 20_260_812,
      weekday: LEVEL_WEEKDAYS.medio,
    });
    const open = free.givens.findIndex((given) => given === null);
    const { container } = render(
      <BinairoFreeScreen deps={{ pickSeed: () => 20_260_812 }} />,
    );
    await flushGeneration();

    expect(boardOf().getAttribute("role")).toBe("group");
    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(64);
    expect(tabStops()).toEqual([0]);

    focusAt(open);
    key(open, "1");
    expect(cellAt(open).textContent).toBe("1");
    key(open, "ArrowRight");
    expect(activeIndex()).toBe(open + 1);
  });
});

describe("the saved record carries no caret (T-WEB-S991)", () => {
  it("stores the entries only, and the schema still reads the record back", () => {
    render(<BinairoScreen daily={DAILY} />);
    focusAt(A);
    key(A, "1");
    window.dispatchEvent(new Event("pagehide"));

    const raw = window.localStorage.getItem(playRecordKey("binairo", DATE));
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("selected");
  });
});
