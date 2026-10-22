import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { BinaryMark } from "./binary-grid";
import type { Press } from "./brush";
import { isShortcut, keyMove } from "./grid-selection";
import { usePointerStroke } from "./use-pointer-stroke";

export interface BinaryBoard {
  readonly tabbable: number;
  readonly boardProps: ComponentPropsWithRef<"div">;
  readonly onCellClick: (
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
}

const DEFAULT_KEYS: ReadonlyMap<string, BinaryMark | null> = new Map([
  ["1", 1],
  ["2", 0],
  ["0", null],
  ["Backspace", null],
  ["Delete", null],
]);

export function useBinaryBoard(input: {
  readonly size: number;
  readonly selected: number | null;
  readonly onTap: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;
  readonly onPaintOver: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onEnterValue: (value: BinaryMark) => void;
  readonly onClear: () => void;
  readonly straight?: boolean;
  readonly painting?: boolean;
  readonly keys?: ReadonlyMap<string, BinaryMark | null>;
}): BinaryBoard {
  const {
    size,
    selected,
    onTap,
    onStrokeStart,
    onPaintOver,
    onMove,
    onEnterValue,
    onClear,
    straight = false,
    painting = true,
    keys = DEFAULT_KEYS,
  } = input;
  const boardRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (
      board === null ||
      selected === null ||
      !board.contains(document.activeElement)
    ) {
      return;
    }
    focusCell(board, selected);
  }, [selected]);

  const stroke = usePointerStroke({
    painting,
    onTap,
    onStrokeStart,
    onPaintOver,
    onStrokeEnd: (index) => {
      const board = boardRef.current;
      if (board !== null) {
        focusCell(board, index);
      }
    },
    ...(straight ? { straight: { size } } : {}),
  });

  const clickPressRef = useRef(stroke.clickPress);
  useEffect(() => {
    clickPressRef.current = stroke.clickPress;
  });

  const onCellClick = useCallback(
    (index: number, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.currentTarget.focus();
      const press = clickPressRef.current(event);
      if (press !== null) {
        onTap(index, press);
      }
    },
    [onTap],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isShortcut(event)) {
      return;
    }
    const move = keyMove(event.key, size);
    if (move !== null) {
      event.preventDefault();
      onMove(move.rows, move.columns);
      return;
    }
    const value = keys.get(event.key);
    if (value === undefined) {
      return;
    }
    event.preventDefault();
    if (value === null) {
      onClear();
    } else {
      onEnterValue(value);
    }
  };

  return {
    tabbable: selected ?? 0,
    boardProps: { ref: boardRef, onKeyDown, ...stroke.handlers },
    onCellClick,
  };
}

function focusCell(board: HTMLDivElement, index: number): void {
  board
    .querySelector<HTMLButtonElement>(`[data-cell-index="${index}"]`)
    ?.focus();
}
