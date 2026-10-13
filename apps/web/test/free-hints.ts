import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import {
  nextBinairoStep,
  type BinairoGrid,
  type BinairoStep,
} from "@miolos/games/binairo";
import { nextSudokuStep, type SudokuStep } from "@miolos/games/sudoku";
import { fireEvent, screen } from "@testing-library/react";

import { messages } from "../src/i18n";

export function spendFreeHints(): void {
  for (let left = FREE_HINTS_PER_PUZZLE; left > 0; left -= 1) {
    fireEvent.click(screen.getByText(messages.play.hint.available(left)));
  }
}

export function freeHintSteps(
  givens: readonly number[],
): readonly SudokuStep[] {
  const grid = [...givens];
  const steps: SudokuStep[] = [];
  while (steps.length < FREE_HINTS_PER_PUZZLE) {
    const step = nextSudokuStep(grid);
    if (step === null) {
      throw new Error("the fixture's puzzle stalls before its free hints");
    }
    grid[step.index] = step.digit;
    steps.push(step);
  }
  return steps;
}

export function freeBinairoSteps(givens: BinairoGrid): readonly BinairoStep[] {
  const grid = [...givens];
  const steps: BinairoStep[] = [];
  while (steps.length < FREE_HINTS_PER_PUZZLE) {
    const step = nextBinairoStep(grid);
    if (step === null) {
      throw new Error("the fixture's puzzle stalls before its free hints");
    }
    grid[step.index] = step.value;
    steps.push(step);
  }
  return steps;
}
