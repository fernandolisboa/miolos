import { coloredLines, fixedTone, solveMarkedLine } from "./solve";
import type { ColoredNonogramClues, ColoredNonogramStep } from "./types";

export function nextColoredStep(
  clues: ColoredNonogramClues,
  marks: readonly (number | null)[],
): ColoredNonogramStep | null {
  let cross: ColoredNonogramStep | null = null;
  for (const spec of coloredLines(clues)) {
    const solved = solveMarkedLine(clues, spec, marks);
    if (solved === null) {
      return null;
    }
    for (let k = 0; k < spec.cells.length; k += 1) {
      const index = spec.cells[k]!;
      const value = fixedTone(solved[k]!);
      if ((marks[index] ?? null) !== null || value === null) {
        continue;
      }
      if (value !== 0) {
        return { ...spec, index, value };
      }
      cross ??= { ...spec, index, value };
    }
  }
  return cross;
}
