export function picturePath(
  size: number,
  cells: ArrayLike<unknown>,
  on: unknown = 1,
): string {
  let path = "";
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] === on) {
      const row = Math.floor(index / size);
      const column = index % size;
      path += `M${String(column)} ${String(row)}h1v1h-1z`;
    }
  }
  return path;
}

export function pictureOutline(
  size: number,
  cells: readonly (0 | 1)[],
): string {
  const filled = (row: number, column: number) =>
    row >= 0 &&
    row < size &&
    column >= 0 &&
    column < size &&
    cells[row * size + column] === 1;
  let path = "";
  cells.forEach((cell, index) => {
    if (cell !== 1) {
      return;
    }
    const row = Math.floor(index / size);
    const column = index % size;
    const at = (x: number, y: number) => `M${String(x)} ${String(y)}`;
    if (!filled(row - 1, column)) path += `${at(column, row)}h1`;
    if (!filled(row + 1, column)) path += `${at(column, row + 1)}h1`;
    if (!filled(row, column - 1)) path += `${at(column, row)}v1`;
    if (!filled(row, column + 1)) path += `${at(column + 1, row)}v1`;
  });
  return path;
}
