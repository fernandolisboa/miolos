export function neighbours(
  rows: number,
  columns: number,
  index: number,
): number[] {
  const row = Math.floor(index / columns);
  const column = index % columns;
  const result: number[] = [];
  for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r += 1) {
    for (
      let c = Math.max(0, column - 1);
      c <= Math.min(columns - 1, column + 1);
      c += 1
    ) {
      if (r !== row || c !== column) {
        result.push(r * columns + c);
      }
    }
  }
  return result;
}

export function assertCell(cells: number, index: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= cells) {
    throw new RangeError(
      `cell index must be an integer in [0, ${String(cells)}), got ${String(index)}`,
    );
  }
}
