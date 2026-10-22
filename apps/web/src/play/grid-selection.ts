import { unlit } from "./hint-state";
import type { HintState } from "./types";

export interface GridMove {
  readonly rows: number;
  readonly columns: number;
}

export function movedSelection(
  selected: number | null,
  move: GridMove,
  rows: number,
  columns = rows,
): number {
  if (selected === null) {
    return 0;
  }
  const clamp = (value: number, size: number) =>
    Math.min(Math.max(value, 0), size - 1);
  const row = clamp(Math.floor(selected / columns) + move.rows, rows);
  const column = clamp((selected % columns) + move.columns, columns);
  return row * columns + column;
}

export function isShortcut(event: {
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

export function keyMove(
  key: string,
  rows: number,
  columns = rows,
): GridMove | null {
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
      return { rows: 0, columns: 1 - columns };
    case "End":
      return { rows: 0, columns: columns - 1 };
    case "PageUp":
      return { rows: 1 - rows, columns: 0 };
    case "PageDown":
      return { rows: rows - 1, columns: 0 };
    default:
      return null;
  }
}

export type CaretAction =
  | { readonly type: "select"; readonly index: number }
  | {
      readonly type: "move-selection";
      readonly rows: number;
      readonly columns: number;
    };

export type CaretWriteAction<M extends number> =
  | CaretAction
  | { readonly type: "enter-value"; readonly value: M }
  | { readonly type: "clear-cell" };

export function withCaret<
  S extends {
    readonly entries: readonly unknown[];
    readonly selected: number | null;
    readonly hint: HintState<unknown>;
  },
>(state: S, action: CaretAction, size: number): S {
  const next =
    action.type === "select"
      ? onBoard(state.entries, action.index)
        ? action.index
        : state.selected
      : movedSelection(state.selected, action, size);
  return state.selected === next ? state : { ...unlit(state), selected: next };
}

export function onBoard(
  entries: readonly unknown[],
  index: number | null,
): boolean {
  return (
    index !== null &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < entries.length
  );
}
