export interface GridMove {
  readonly rows: number;
  readonly columns: number;
}

export function movedSelection(
  selected: number | null,
  move: GridMove,
  size: number,
): number {
  if (selected === null) {
    return 0;
  }
  const clamp = (value: number) => Math.min(Math.max(value, 0), size - 1);
  const row = clamp(Math.floor(selected / size) + move.rows);
  const column = clamp((selected % size) + move.columns);
  return row * size + column;
}

export function isShortcut(event: {
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

export function keyMove(key: string, size: number): GridMove | null {
  const span = size - 1;
  switch (key) {
    case "ArrowUp":
      return { rows: -1, columns: 0 };
    case "ArrowDown":
      return { rows: 1, columns: 0 };
    case "ArrowLeft":
      return { rows: 0, columns: -1 };
    case "ArrowRight":
      return { rows: 0, columns: 1 };
    case "Home":
      return { rows: 0, columns: -span };
    case "End":
      return { rows: 0, columns: span };
    case "PageUp":
      return { rows: -span, columns: 0 };
    case "PageDown":
      return { rows: span, columns: 0 };
    default:
      return null;
  }
}
