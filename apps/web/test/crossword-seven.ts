import { projectCrossword, type DailyCrosswordResponse } from "@miolos/core";

const WORDS = [
  { number: 1, direction: "across", row: 0, col: 0, normalized: "cabelos" },
  { number: 1, direction: "down", row: 0, col: 0, normalized: "cadeira" },
  { number: 2, direction: "down", row: 0, col: 6, normalized: "saudade" },
  { number: 3, direction: "across", row: 6, col: 0, normalized: "atuante" },
] as const;

const GRID: (string | null)[][] = Array.from({ length: 7 }, () =>
  Array.from({ length: 7 }, () => null),
);
for (const { direction, row, col, normalized } of WORDS) {
  [...normalized].forEach((letter, step) => {
    const line = GRID[direction === "across" ? row : row + step];
    if (line !== undefined) {
      line[direction === "across" ? col + step : col] = letter;
    }
  });
}

export const SEVEN_DAILY: DailyCrosswordResponse = projectCrossword(
  "2026-08-01",
  {
    grid: GRID,
    entries: WORDS.map((word) => ({
      ...word,
      clue: `pista ${word.normalized}`,
    })),
  },
);
