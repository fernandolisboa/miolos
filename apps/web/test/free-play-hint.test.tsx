import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { useFreeCrossword } from "../src/free-play/use-free-crossword";
import { messages } from "../src/i18n";
import boardStyles from "../src/nonogram/nonogram-board.module.css";
import { sudokuHintExplanation } from "../src/sudoku/hint";
import sudokuBoardStyles from "../src/sudoku/sudoku-board.module.css";
import { freeHintSteps, spendFreeHints } from "./free-hints";

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

function boardText(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll("[data-cell-index]")].map(
    (cell) => cell.textContent ?? "",
  );
}

function exhaustedHint(): HTMLElement {
  const button = screen.getByText(messages.play.hint.used).closest("button");
  expect(button).toHaveAttribute("aria-disabled", "true");
  if (button === null) {
    throw new Error("the spent hint rendered no button");
  }
  return button;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("three free hints per free-play puzzle, the next press inert (T-WEB-S122)", () => {
  it("Binairo: the hint writes the generator solution's cell, then stops", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateBinairo({ seed: SEED, weekday: WEEKDAY });
    const firstEmpty = puzzle.givens.findIndex((cell) => cell === null);
    const { container } = render(<BinairoFreeScreen deps={stableDeps(SEED)} />);

    const button = screen
      .getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE))
      .closest("button");
    expect(button).toHaveAttribute("aria-disabled", "false");
    spendFreeHints();

    expect(cellText(container, firstEmpty)).toBe(
      String(puzzle.solution[firstEmpty]),
    );
    const spent = boardText(container);
    fireEvent.click(exhaustedHint());
    expect(boardText(container)).toEqual(spent);
  });

  it("Sudoku: the hint writes the narrowed solution digit, then stops", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateDailySudoku({ seed: SEED, weekday: WEEKDAY });
    const { container } = render(<SudokuFreeScreen deps={stableDeps(SEED)} />);

    spendFreeHints();

    for (const { index } of freeHintSteps(puzzle.givens)) {
      expect(cellText(container, index)).toBe(String(puzzle.solution[index]));
    }
    const spent = boardText(container);
    fireEvent.click(exhaustedHint());
    expect(boardText(container)).toEqual(spent);
  });

  it("Nonogram: the bare use-hint verb fires against the clue-derived solution", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateNonogram(SEED, WEEKDAY);
    const { container } = render(
      <NonogramFreeScreen deps={stableDeps(SEED)} />,
    );

    const marked = () =>
      container.querySelectorAll(
        `.${boardStyles.cellFilled}, .${boardStyles.cellCrossed}`,
      ).length;
    expect(puzzle.size).toBe(10);
    expect(marked()).toBe(0);

    spendFreeHints();

    expect(marked()).toBe(FREE_HINTS_PER_PUZZLE);
    fireEvent.click(exhaustedHint());
    expect(marked()).toBe(FREE_HINTS_PER_PUZZLE);
  });
});

describe("free-play Sudoku reveals and explains the next logical step (T-WEB-S545)", () => {
  it("writes the step's digit, reads out why and tints the step's cells", () => {
    vi.stubGlobal("fetch", vi.fn());
    const puzzle = generateDailySudoku({ seed: SEED, weekday: WEEKDAY });
    const [step] = freeHintSteps(puzzle.givens);
    if (step === undefined) {
      throw new Error("no first step");
    }
    const { container } = render(<SudokuFreeScreen deps={stableDeps(SEED)} />);

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(cellText(container, step.index)).toBe(String(step.digit));
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      sudokuHintExplanation({ kind: "step", step }),
    );
    const tinted = [
      ...container.querySelectorAll<HTMLElement>(
        `.${sudokuBoardStyles.cellUnit}`,
      ),
    ].map((cell) => Number(cell.dataset.cellIndex));
    expect(tinted).toEqual(
      step.cells.filter((index) => index !== step.index).sort((a, b) => a - b),
    );
  });
});

describe("the free crossword's free hints (T-WEB-S122a)", () => {
  it("reveals the first white cell's letter, and the press after the last does nothing", () => {
    vi.stubGlobal("fetch", vi.fn());
    const deps = stableDeps(SEED);
    const { result } = renderHook(() => useFreeCrossword(deps));
    const { phase } = result.current;
    if (phase.kind !== "ready") {
      throw new Error("the crossword did not generate");
    }
    const cells = phase.puzzle.daily.grid.flat();
    const first = cells.findIndex((cell) => cell !== null);
    const copy = messages.games.crossword.play;
    const aria = (letter: string | null) =>
      copy.cellAria(Math.floor(first / 5) + 1, (first % 5) + 1, letter);
    const { container } = render(
      <CrosswordFreeScreen deps={stableDeps(SEED)} />,
    );
    const cell = () =>
      container.querySelector(`[data-cell-index="${String(first)}"]`);

    expect(cell()?.getAttribute("aria-label")).toBe(aria(null));
    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(cell()?.getAttribute("aria-label")).toBe(aria(cells[first] ?? ""));
    for (let left = FREE_HINTS_PER_PUZZLE - 1; left > 0; left -= 1) {
      fireEvent.click(screen.getByText(messages.play.hint.available(left)));
    }
    const labels = () =>
      [...container.querySelectorAll("[data-cell-index]")].map((at) =>
        at.getAttribute("aria-label"),
      );
    const spent = labels();
    fireEvent.click(exhaustedHint());
    expect(labels()).toEqual(spent);
  });
});
