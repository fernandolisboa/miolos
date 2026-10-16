export function neighbours(size: number, cell: number): number[] {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const near: number[] = [];
  if (row > 0) near.push(cell - size);
  if (col > 0) near.push(cell - 1);
  if (col < size - 1) near.push(cell + 1);
  if (row < size - 1) near.push(cell + size);
  return near;
}

export function floodRegion(
  size: number,
  regions: readonly number[],
  start: number,
): Set<number> {
  const reached = new Set([start]);
  const stack = [start];
  for (let cell = stack.pop(); cell !== undefined; cell = stack.pop()) {
    for (const next of neighbours(size, cell)) {
      if (regions[next] === regions[start] && !reached.has(next)) {
        reached.add(next);
        stack.push(next);
      }
    }
  }
  return reached;
}

export function relabel(regions: readonly number[]): number[] {
  const order = [...new Set(regions)];
  return regions.map((id) => order.indexOf(id));
}
