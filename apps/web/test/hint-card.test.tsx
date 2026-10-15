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
import binairoStyles from "../src/binairo/binairo-screen.module.css";
import crosswordStyles from "../src/crossword/crossword-board.module.css";
import nonogramStyles from "../src/nonogram/nonogram-board.module.css";
import { BoardCard } from "../src/play/board-card";
import hintCardStyles from "../src/play/hint-card.module.css";
import {
  hintArea,
  hintCardWidth,
  placeHintCard,
  revealScroll,
  type Box,
} from "../src/play/hint-card-place";
import { PlayScreenChrome } from "../src/play/screen-chrome";
import screenStyles from "../src/play/screen.module.css";
import queensStyles from "../src/queens/queens-board.module.css";
import sudokuStyles from "../src/sudoku/sudoku-board.module.css";
import { flushGeneration } from "./free-generation";
import { hintCardLoaded } from "./hint-reason";

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

  it("goes below only when above crosses the field and below has more room", () => {
    expect(
      placeHintCard(box(100, 40), CARD, { ...AREA, bottom: 120 }),
    ).toMatchObject({
      below: false,
    });
    expect(
      placeHintCard(box(100, 20), CARD, { ...AREA, bottom: 120 }),
    ).toMatchObject({
      below: true,
    });
  });

  it("bounds by the board card, the field's top and the viewport's width", () => {
    const frame: Box = { left: -10, top: -300, right: 900, bottom: 200 };

    expect(hintArea(frame, -280, 800)).toEqual({
      left: 0,
      top: -280,
      right: 800,
      bottom: 200,
    });
  });

  it("scrolls just enough to show a card placed off screen, never past its top", () => {
    expect(revealScroll(-40, 60, 800)).toBe(-40);
    expect(revealScroll(100, 60, 800)).toBe(0);
    expect(revealScroll(780, 60, 800)).toBe(40);
    expect(revealScroll(30, 900, 800)).toBe(30);
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
  it("opens on a pointer reveal, hidden from screen readers, and the live region speaks", async () => {
    render(<Harness />);
    expect(card()).toBeNull();

    const button = hintButton();
    fireEvent.pointerDown(button);
    fireEvent.mouseDown(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    await hintCardLoaded();

    expect(card()?.textContent).toBe(REASON);
    expect(card()).toHaveAttribute("aria-hidden", "true");
    expect(spoken()).toBe(REASON);
  });

  it("opens from the keyboard and stays open through Tab, modifiers and key repeat", async () => {
    render(<Harness />);
    const button = hintButton();

    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    await hintCardLoaded();
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
  ])(
    "closes on %s, and the reason stays in the live region",
    async (_, act) => {
      render(<Harness />);
      fireEvent.click(hintButton());
      await hintCardLoaded();

      act();

      expect(card()).toBeNull();
      expect(spoken()).toBe(REASON);
    },
  );

  it("opens a fresh card for the next hint", async () => {
    render(<Harness />);
    fireEvent.click(hintButton());
    await hintCardLoaded();
    fireEvent.pointerDown(document.body);

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.play.hint.available(FREE_HINTS_PER_PUZZLE - 1),
      }),
    );
    await hintCardLoaded();

    expect(card()?.textContent).toBe(REASON);
  });

  it("draws nothing without a hinted cell, and hides itself when the cell is gone", async () => {
    const { unmount } = render(<Harness cell={null} />);
    fireEvent.click(hintButton());
    await hintCardLoaded();
    expect(card()).toBeNull();
    expect(spoken()).toBe(REASON);
    unmount();

    render(<Harness cell={9} />);
    fireEvent.click(hintButton());
    await hintCardLoaded();
    expect(card()).toHaveAttribute("hidden");
  });
});

const CELL_LEFT = 1000;
const BOARD_ORIGIN = { x: 7, y: 3 };

function stubLayout() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const index = this.getAttribute("data-cell-index");
      if (index !== null) {
        const x = CELL_LEFT + Number(index);
        return DOMRect.fromRect({ x, y: 500, width: 20, height: 20 });
      }
      const origin = this.tagName === "SECTION" ? BOARD_ORIGIN : { x: 0, y: 0 };
      return DOMRect.fromRect({ ...origin, width: 5000, height: 5000 });
    },
  );
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(5000);
}

const SCREENS: readonly (readonly [
  string,
  () => ReactElement,
  string | undefined,
  7 | null,
])[] = [
  [
    "Sudoku",
    () => <SudokuFreeScreen deps={{ pickSeed: () => 7 }} />,
    sudokuStyles.cellHinted,
    null,
  ],
  [
    "Binairo",
    () => <BinairoFreeScreen deps={{ pickSeed: () => 7 }} />,
    binairoStyles.cellHinted,
    null,
  ],
  [
    "Nonogram",
    () => <NonogramFreeScreen deps={{ pickSeed: () => 7 }} />,
    nonogramStyles.cellHinted,
    null,
  ],
  [
    "Rainhas",
    () => <QueensFreeScreen deps={{ pickSeed: () => 7 }} />,
    queensStyles.cellHinted,
    null,
  ],
  [
    "Cruzadinha",
    () => <CrosswordFreeScreen deps={{ pickSeed: () => 7 }} />,
    crosswordStyles.cellHinted,
    null,
  ],
  [
    "Cruzadinha 7×7",
    () => <CrosswordFreeScreen deps={{ pickSeed: () => 7 }} />,
    crosswordStyles.cellHinted,
    7,
  ],
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

  it.each(SCREENS)("%s", async (_, element, hinted, size) => {
    const { container } = render(element());
    await flushGeneration();
    if (size !== null) {
      fireEvent.click(
        screen.getByRole("radio", { name: messages.freePlay.size.aria(size) }),
      );
      await flushGeneration();
      expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(
        size * size,
      );
    }

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );
    await hintCardLoaded();

    const placed = card() as HTMLElement | null;
    const anchor =
      Number.parseFloat(placed?.style.left ?? "") + BOARD_ORIGIN.x + 16 - 10;
    const index = String(anchor - CELL_LEFT);
    const cell = container.querySelector(`[data-cell-index="${index}"]`);
    expect(hinted).toBeTruthy();
    expect(cell?.className.split(" ")).toContain(hinted);
    expect(placed?.dataset.side).toBe("below");
    expect(placed?.style.top).toBe(`${String(528 - BOARD_ORIGIN.y)}px`);
    expect(placed?.style.maxWidth).toBe("180px");
  });
});
