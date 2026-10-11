import { attacks, checkGrid, geometryOf } from "./internal";
import type { QueensBoard, QueensGrid } from "./types";

export function findQueensViolations(
  board: QueensBoard,
  queens: QueensGrid,
): readonly number[] {
  const geometry = geometryOf(board);
  checkGrid(board.size, queens);
  const placed = queens.flatMap((cell, index) => (cell === 1 ? [index] : []));
  return placed.filter((a) => placed.some((b) => attacks(geometry, a, b)));
}

export function isValidQueensSolution(
  board: QueensBoard,
  queens: QueensGrid,
): boolean {
  return (
    findQueensViolations(board, queens).length === 0 &&
    queens.filter((cell) => cell === 1).length === board.size
  );
}
