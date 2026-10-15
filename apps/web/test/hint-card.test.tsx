import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { QueensFreeScreen } from "../src/free-play/queens-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import { BoardCard } from "../src/play/board-card";
import hintCardStyles from "../src/play/hint-card.module.css";
import {
  hintArea,
  hintCardWidth,
  placeHintCard,
  type Box,
} from "../src/play/hint-card-place";
import { PlayScreenChrome } from "../src/play/screen-chrome";
import screenStyles from "../src/play/screen.module.css";

const REASON = "O 7 só cabe aqui na linha.";

function box(left: number, top: number, side = 40): Box {
  return { left, top, right: left + side, bottom: top + side };
}

const AREA: Box = { left: 0, top: 0, right: 400, bottom: 400 };
const CARD = { width: 180, height: 60 };

describe("the hint card sits on the hinted cell and stays inside the board (T-WEB-S690)", () => {
  it("rises from the cell's top edge with its body running right, the tail on the cell", () => {
    expect(placeHintCard(box(100, 200), CARD, AREA)).toEqual({
      left: 104,
      top: 132,
      tail: 16,
      below: false,
    });
  });

  it("runs left when the right edge would cut it", () => {
    expect(placeHintCard(box(320, 200), CARD, AREA)).toEqual({
      left: 176,
      top: 132,
      tail: 164,
      below: false,
    });
  });

  it("centres on the cell, clamped to the board, when neither side fits", () => {
    const narrow: Box = { left: 0, top: 0, right: 240, bottom: 400 };

    expect(placeHintCard(box(100, 200), CARD, narrow)).toMatchObject({
      left: 30,
      tail: 90,
    });
    expect(
      placeHintCard(box(30, 200), CARD, { ...narrow, right: 190 }),
    ).toMatchObject({ left: 0, tail: 50 });
  });

  it("drops below the cell when above would cross the top of the field", () => {
    expect(placeHintCard(box(100, 40), CARD, AREA)).toMatchObject({
      top: 88,
      below: true,
    });
  });

  it("is three cells wide, never under 180px, never wider than the board", () => {
    expect(hintCardWidth(box(0, 0, 70), AREA)).toBe(210);
    expect(hintCardWidth(box(0, 0, 30), AREA)).toBe(180);
    expect(hintCardWidth(box(0, 0, 70), { ...AREA, right: 150 })).toBe(150);
  });

  it("bounds by the field's top and the viewport, and by the board alone once the cell scrolled off", () => {
    const frame: Box = { left: -10, top: -300, right: 900, bottom: 200 };

    expect(hintArea(frame, -280, box(0, 20), 800)).toEqual({
      left: 0,
      top: 0,
      right: 800,
      bottom: 200,
    });
    expect(hintArea(frame, -280, box(0, -60), 800).top).toBe(-280);
  });
});

function Harness({ cell = 4 }: { readonly cell?: number | null }) {
  const [used, setUsed] = useState(0);
  return (
    <PlayScreenChrome
      game="sudoku"
      pageModifier="page-mark"
      state={{
        kind: "playing",
        readouts: {
          progressShort: "1/81",
          progressLong: "1 de 81",
          hint: {
            ready: true,
            used,
            explain: used === 0 ? null : REASON,
            cell,
            onReveal: () => {
              setUsed((count) => count + 1);
            },
          },
          onReset: null,
        },
      }}
      back={{ href: "/", label: "Voltar", ariaLabel: "Voltar" }}
      topDate="15 de outubro"
      note={null}
      clock="none"
      extraStat={null}
    >
      <BoardCard>
        <button type="button" data-cell-index={4}>
          7
        </button>
      </BoardCard>
    </PlayScreenChrome>
  );
}

function hintButton(): HTMLElement {
  return screen.getByRole("button", {
    name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
  });
}

function card(): Element | null {
  return document.querySelector(`.${hintCardStyles.card ?? ""}`);
}

function spoken(): string {
  return (
    document.querySelector(`.${screenStyles.hintLive ?? ""}`)?.textContent ?? ""
  );
}

describe("the chrome shows the reason on the hinted cell until the next press (T-WEB-S691)", () => {
  it("opens on a pointer reveal, hidden from screen readers, and the live region speaks", () => {
    render(<Harness />);
    expect(card()).toBeNull();

    const button = hintButton();
    fireEvent.pointerDown(button);
    fireEvent.mouseDown(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button);

    expect(card()?.textContent).toBe(REASON);
    expect(card()).toHaveAttribute("aria-hidden", "true");
    expect(spoken()).toBe(REASON);
  });

  it("survives the Enter that revealed it, Tab, modifiers and key repeat", () => {
    render(<Harness />);
    const button = hintButton();

    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    fireEvent.keyUp(button, { key: "Enter" });
    fireEvent.keyDown(document.body, { key: "Tab" });
    fireEvent.keyDown(document.body, { key: "Shift" });
    fireEvent.keyDown(document.body, { key: "7", repeat: true });

    expect(card()?.textContent).toBe(REASON);
  });

  it.each([
    ["a press anywhere", () => fireEvent.pointerDown(document.body)],
    ["a key", () => fireEvent.keyDown(document.body, { key: "ArrowRight" })],
    ["Escape", () => fireEvent.keyDown(document.body, { key: "Escape" })],
  ])("closes on %s, and the reason stays in the live region", (_, act) => {
    render(<Harness />);
    fireEvent.click(hintButton());

    act();

    expect(card()).toBeNull();
    expect(spoken()).toBe(REASON);
  });

  it("opens a fresh card for the next hint", () => {
    render(<Harness />);
    fireEvent.click(hintButton());
    fireEvent.pointerDown(document.body);

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE - 1),
      }),
    );

    expect(card()?.textContent).toBe(REASON);
  });

  it("draws nothing without a hinted cell, and hides itself when the cell is gone", () => {
    const { unmount } = render(<Harness cell={null} />);
    fireEvent.click(hintButton());
    expect(card()).toBeNull();
    expect(spoken()).toBe(REASON);
    unmount();

    render(<Harness cell={9} />);
    fireEvent.click(hintButton());
    expect(card()).toHaveAttribute("hidden");
  });
});

const CELL_LEFT = 1000;

function stubLayout() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const index = this.getAttribute("data-cell-index");
      const left = index === null ? 0 : CELL_LEFT + Number(index);
      const side = index === null ? 5000 : 20;
      const top = index === null ? 0 : 500;
      return DOMRect.fromRect({ x: left, y: top, width: side, height: side });
    },
  );
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: 5000,
  });
}

const SCREENS: readonly (readonly [string, () => ReactElement])[] = [
  ["Sudoku", () => <SudokuFreeScreen deps={{ pickSeed: () => 7 }} />],
  ["Binairo", () => <BinairoFreeScreen deps={{ pickSeed: () => 7 }} />],
  ["Nonogram", () => <NonogramFreeScreen deps={{ pickSeed: () => 7 }} />],
  ["Rainhas", () => <QueensFreeScreen deps={{ pickSeed: () => 7 }} />],
  ["Cruzadinha", () => <CrosswordFreeScreen deps={{ pickSeed: () => 7 }} />],
];

describe("every grid game anchors the card on the cell its hint wrote (T-WEB-S692)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    stubLayout();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(SCREENS)("%s", (_, element) => {
    const { container } = render(element());
    const before = new Map(
      [...container.querySelectorAll("[data-cell-index]")].map((cell) => [
        cell.getAttribute("data-cell-index"),
        cell.outerHTML,
      ]),
    );

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    const placed = card() as HTMLElement | null;
    const anchor = Number.parseFloat(placed?.style.left ?? "") + 16 - 10;
    const index = String(anchor - CELL_LEFT);
    const cell = container.querySelector(`[data-cell-index="${index}"]`);
    expect(cell).not.toBeNull();
    expect(cell?.outerHTML).not.toBe(before.get(index));
    expect(placed?.dataset.side).toBe("below");
  });
});
