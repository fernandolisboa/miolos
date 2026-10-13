import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { fireEvent, screen } from "@testing-library/react";

import { messages } from "../src/i18n";

export function spendFreeHints(): void {
  for (let left = FREE_HINTS_PER_PUZZLE; left > 0; left -= 1) {
    fireEvent.click(screen.getByText(messages.play.hint.available(left)));
  }
}

export function freeHintSteps<C, S extends { readonly index: number }>(
  givens: readonly C[],
  next: (grid: readonly C[]) => S | null,
  valueOf: (step: S) => C,
): readonly S[] {
  const grid = [...givens];
  const steps: S[] = [];
  while (steps.length < FREE_HINTS_PER_PUZZLE) {
    const step = next(grid);
    if (step === null) {
      throw new Error("the fixture's puzzle stalls before its free hints");
    }
    grid[step.index] = valueOf(step);
    steps.push(step);
  }
  return steps;
}
