import type { MinesweeperState } from "@miolos/games/minesweeper";

export type CellView =
  "hidden" | "flag" | "question" | "mine" | "hit" | "wrongFlag" | number;

export function cellView(game: MinesweeperState, index: number): CellView {
  const { field, open, marks, status, hit } = game;
  if (open[index]) {
    return field?.counts[index] ?? 0;
  }
  const mark = marks[index] ?? null;
  if (status === "lost" && field !== null) {
    if (index === hit) {
      return "hit";
    }
    if (field.mines[index] && mark !== "flag") {
      return "mine";
    }
    if (!field.mines[index] && mark === "flag") {
      return "wrongFlag";
    }
  }
  return mark ?? "hidden";
}
