import type { CrosswordSlot } from "./types";

export function slotCells(
  start: Pick<CrosswordSlot, "direction" | "row" | "col">,
  length: number,
): [row: number, col: number][] {
  return Array.from({ length }, (_, k) =>
    start.direction === "across"
      ? [start.row, start.col + k]
      : [start.row + k, start.col],
  );
}

export function deriveSlots(
  blocks: ReadonlyArray<ReadonlyArray<boolean>>,
): CrosswordSlot[] {
  const isWhite = (row: number, col: number): boolean =>
    blocks[row]?.[col] === false;
  const runLength = (row: number, col: number, dRow: number, dCol: number) => {
    let length = 0;
    while (isWhite(row + dRow * length, col + dCol * length)) {
      length += 1;
    }
    return length;
  };

  const across: CrosswordSlot[] = [];
  const down: CrosswordSlot[] = [];
  let number = 0;
  blocks.forEach((cells, row) => {
    cells.forEach((_, col) => {
      if (!isWhite(row, col)) {
        return;
      }
      const acrossLength = isWhite(row, col - 1)
        ? 0
        : runLength(row, col, 0, 1);
      const downLength = isWhite(row - 1, col) ? 0 : runLength(row, col, 1, 0);
      if (acrossLength < 2 && downLength < 2) {
        return;
      }
      number += 1;
      if (acrossLength >= 2) {
        across.push({
          number,
          direction: "across",
          row,
          col,
          length: acrossLength,
        });
      }
      if (downLength >= 2) {
        down.push({ number, direction: "down", row, col, length: downLength });
      }
    });
  });
  return [...across, ...down];
}
