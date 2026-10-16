import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import boardStyles from "../src/crossword/crossword-board.module.css";
import clueStyles from "../src/crossword/clues.module.css";
import {
  CrosswordBoardView,
  crosswordReadouts,
} from "../src/crossword/board-view";
import { useCrosswordBoard } from "../src/crossword/use-crossword-board";
import { SEVEN_DAILY } from "./crossword-seven";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/cruzadinha/livre",
}));

const copy = messages.games.crossword.play;

function Harness() {
  const board = useCrosswordBoard(SEVEN_DAILY);
  const { hint } = crosswordReadouts(board);
  return (
    <>
      <CrosswordBoardView board={board} />
      <p data-testid="explain">{hint?.explain}</p>
      <button type="button" onClick={hint?.onReveal}>
        revelar
      </button>
    </>
  );
}

function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (found === null) {
    throw new Error(`no cell ${index}`);
  }
  return found;
}

function selectedIndex(): number {
  const tabbable = document.querySelector<HTMLElement>(
    '[data-cell-index][tabindex="0"]',
  );
  return Number(tabbable?.dataset.cellIndex);
}

function press(key: string): void {
  fireEvent.keyDown(screen.getByRole("group", { name: copy.boardAria(7) }), {
    key,
  });
}

describe("a 7x7 Cruzadinha renders and navigates by its own side (T-WEB-S675)", () => {
  it("places each clue number on the cell where its entry starts", () => {
    render(<Harness />);

    expect(within(cell(0)).getByText("1")).toBeTruthy();
    expect(within(cell(6)).getByText("2")).toBeTruthy();
    expect(within(cell(42)).getByText("3")).toBeTruthy();
    expect(document.querySelectorAll(`.${boardStyles.number}`)).toHaveLength(3);
  });

  it("labels each cell with its own row and column", () => {
    render(<Harness />);

    expect(cell(42).getAttribute("aria-label")).toBe(copy.cellAria(7, 1, null));
    expect(cell(48).getAttribute("aria-label")).toBe(copy.cellAria(7, 7, null));
  });

  it("jumps to the row and column ends of a 7x7 with End and PageDown", () => {
    render(<Harness />);

    fireEvent.focus(cell(0));
    press("End");
    expect(selectedIndex()).toBe(6);

    fireEvent.focus(cell(0));
    press("PageDown");
    expect(selectedIndex()).toBe(42);
  });

  it("selects the first cell of a clicked clue and lights up its whole entry", () => {
    render(<Harness />);

    const item = screen.getByRole("button", {
      name: `${copy.clueLabel(3, "across")} — pista atuante`,
    });
    fireEvent.click(item);

    expect(selectedIndex()).toBe(42);
    expect(item.className).toContain(clueStyles.itemActive);
    const active = Array.from(
      document.querySelectorAll(`.${boardStyles.cellActive}`),
    ).map((node) => Number((node as HTMLElement).dataset.cellIndex));
    expect(active.sort((a, b) => a - b)).toEqual([42, 43, 44, 45, 46, 47, 48]);
    expect(cell(42).className).toContain(boardStyles.cellSelected);
    expect(screen.getByRole("status").textContent).toBe(
      `${copy.clueLabel(3, "across")} · pista atuante`,
    );
  });

  it("names the hinted cell's row and column on a 7x7", () => {
    render(<Harness />);

    fireEvent.click(
      screen.getByRole("button", {
        name: `${copy.clueLabel(2, "down")} — pista saudade`,
      }),
    );
    for (const key of ["s", "a", "u", "d", "a", "d"]) {
      press(key);
    }
    fireEvent.click(screen.getByRole("button", { name: "revelar" }));

    expect(cell(48).textContent).toBe("e");
    expect(screen.getByTestId("explain").textContent).toBe(
      copy.hint.explain.step(
        copy.clueLabel(2, "down"),
        copy.clueLabel(3, "across"),
        7,
        7,
      ),
    );
  });
});
