import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { messages } from "../src/i18n";
import boardStyles from "../src/nonogram/nonogram-board.module.css";

const SEED = 20_260_812;
const WEEKDAY = LEVEL_WEEKDAYS.medio;

function stableDeps(seed: number) {
  return { pickSeed: () => seed };
}

function cellText(container: HTMLElement, index: number): string {
  return (
    container.querySelector(`[data-cell-index="${index}"]`)?.textContent ?? ""
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("one free hint per free-play puzzle, second press inert (T-WEB-S122)", () => {
  it("Binairo: the hint writes the generator solution's cell, once", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateBinairo({ seed: SEED, weekday: WEEKDAY });
    const firstEmpty = puzzle.givens.findIndex((cell) => cell === null);
    const { container } = render(<BinairoFreeScreen deps={stableDeps(SEED)} />);
    const copy = messages.games.binairo.play.hint;

    const button = screen.getByText(copy.available).closest("button");
    expect(button).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(screen.getByText(copy.available));

    expect(cellText(container, firstEmpty)).toBe(
      String(puzzle.solution[firstEmpty]),
    );
    const used = screen.getByText(copy.used).closest("button");
    expect(used).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByText(copy.used));
    expect(cellText(container, firstEmpty)).toBe(
      String(puzzle.solution[firstEmpty]),
    );
    expect(screen.getByText(copy.used)).toBeInTheDocument();
  });

  it("Sudoku: the hint writes the narrowed solution digit, once", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateDailySudoku({ seed: SEED, weekday: WEEKDAY });
    const firstEmpty = puzzle.givens.findIndex((cell) => cell === 0);
    const { container } = render(<SudokuFreeScreen deps={stableDeps(SEED)} />);
    const copy = messages.games.sudoku.play.hint;

    fireEvent.click(screen.getByText(copy.available));

    expect(cellText(container, firstEmpty)).toBe(
      String(puzzle.solution[firstEmpty]),
    );
    const used = screen.getByText(copy.used).closest("button");
    expect(used).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByText(copy.used));
    expect(cellText(container, firstEmpty)).toBe(
      String(puzzle.solution[firstEmpty]),
    );
  });

  it("Nonogram: the bare use-hint verb fires against the clue-derived solution", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateNonogram(SEED, WEEKDAY);
    const { container } = render(
      <NonogramFreeScreen deps={stableDeps(SEED)} />,
    );
    const copy = messages.games.nonogram.play.hint;

    const marked = () =>
      container.querySelectorAll(
        `.${boardStyles.cellFilled}, .${boardStyles.cellCrossed}`,
      ).length;
    expect(puzzle.size).toBe(10);
    expect(marked()).toBe(0);

    fireEvent.click(screen.getByText(copy.available));

    expect(marked()).toBe(1);
    const used = screen.getByText(copy.used).closest("button");
    expect(used).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByText(copy.used));
    expect(marked()).toBe(1);
  });
});
