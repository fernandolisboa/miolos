export type StrokeAxis = "row" | "column";

export interface Travel {
  readonly x: number;
  readonly y: number;
}

export function strokeAxis(
  size: number,
  start: number,
  entered: number,
  travel: Travel,
): StrokeAxis {
  if (rowOf(start, size) === rowOf(entered, size)) {
    return "row";
  }
  if (start % size === entered % size) {
    return "column";
  }
  return Math.abs(travel.x) >= Math.abs(travel.y) ? "row" : "column";
}

export function projectOnLine(
  size: number,
  start: number,
  axis: StrokeAxis,
  index: number,
): number {
  return axis === "row"
    ? rowOf(start, size) * size + (index % size)
    : rowOf(index, size) * size + (start % size);
}

export function cellsAfter(
  size: number,
  axis: StrokeAxis,
  from: number,
  to: number,
): readonly number[] {
  const step = (axis === "row" ? 1 : size) * Math.sign(to - from);
  const cells: number[] = [];
  for (let index = from; index !== to;) {
    index += step;
    cells.push(index);
  }
  return cells;
}

function rowOf(index: number, size: number): number {
  return Math.floor(index / size);
}
