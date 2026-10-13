import type { BinairoGrid } from "@miolos/games/binairo";

export function mergeGrid(
  givens: BinairoGrid,
  entries: BinairoGrid,
): BinairoGrid {
  return givens.map((given, index) => given ?? entries[index] ?? null);
}
