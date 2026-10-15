export function picturePath<T>(
  size: number,
  cells: ArrayLike<T>,
  on: T,
): string {
  let path = "";
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] === on) {
      path += `${at(index % size, Math.floor(index / size))}h1v1h-1z`;
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
  for (let index = 0; index < cells.length; index++) {
    if (cells[index] !== 1) {
      continue;
    }
    const row = Math.floor(index / size);
    const column = index % size;
    if (!filled(row - 1, column)) path += `${at(column, row)}h1`;
    if (!filled(row + 1, column)) path += `${at(column, row + 1)}h1`;
    if (!filled(row, column - 1)) path += `${at(column, row)}v1`;
    if (!filled(row, column + 1)) path += `${at(column + 1, row)}v1`;
  }
  return path;
}

function at(x: number, y: number): string {
  return `M${String(x)} ${String(y)}`;
}
