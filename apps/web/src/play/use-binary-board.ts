import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { keyMove } from "./grid-selection";
import { usePointerStroke } from "./use-pointer-stroke";

export interface BinaryBoard {
  readonly tabbable: number;
  readonly boardProps: ComponentPropsWithRef<"div">;
  readonly onCellClick: (
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
}

export function useBinaryBoard(input: {
  readonly size: number;
  readonly selected: number | null;
  readonly onTap: (index: number) => void;
  readonly onPaintOver: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onEnterValue: (value: 0 | 1) => void;
  readonly onClear: () => void;
}): BinaryBoard {
  const { size, selected, onTap, onPaintOver, onMove, onEnterValue, onClear } =
    input;
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
    painting: true,
    onTap,
    onPaintOver,
    onStrokeEnd: (index) => {
      const board = boardRef.current;
      if (board !== null) {
        focusCell(board, index);
      }
    },
  });

  const consumedClickRef = useRef(stroke.consumedClick);
  useEffect(() => {
    consumedClickRef.current = stroke.consumedClick;
  });

  const onCellClick = useCallback(
    (index: number, event: ReactMouseEvent<HTMLButtonElement>) => {
      event.currentTarget.focus();
      if (consumedClickRef.current(event)) {
        return;
      }
      onTap(index);
    },
    [onTap],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = keyMove(event.key, size);
    if (move !== null) {
      event.preventDefault();
      onMove(move.rows, move.columns);
      return;
    }
    const value = event.key === "1" ? 1 : event.key === "2" ? 0 : null;
    if (value !== null) {
      event.preventDefault();
      onEnterValue(value);
      return;
    }
    if (
      event.key === "0" ||
      event.key === "Backspace" ||
      event.key === "Delete"
    ) {
      event.preventDefault();
      onClear();
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
