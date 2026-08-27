import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface PointerStrokeHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface PointerStroke {
  readonly handlers: PointerStrokeHandlers;

  readonly consumedClick: (event: { readonly detail: number }) => boolean;
}

export function usePointerStroke(input: {
  readonly painting: boolean;
  readonly onTap: (index: number) => void;
  readonly onPaintOver: (index: number) => void;

  readonly onStrokeEnd?: (index: number) => void;
}): PointerStroke {
  const { painting, onTap, onPaintOver, onStrokeEnd } = input;

  const dragging = useRef(false);
  const dragged = useRef(false);

  const tapped = useRef(false);
  const startIndex = useRef<number | null>(null);
  const lastIndex = useRef<number | null>(null);

  const strokePointer = useRef<number | null>(null);

  const detachWindowEnd = useRef<(() => void) | null>(null);

  const armWindowEnd = () => {
    const end = (native: PointerEvent) => {
      if (native.pointerId !== strokePointer.current) {
        return;
      }
      endDrag();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    detachWindowEnd.current = () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      detachWindowEnd.current = null;
    };
  };

  useEffect(() => () => detachWindowEnd.current?.(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    if (strokePointer.current !== null) {
      return;
    }
    strokePointer.current = event.pointerId;
    dragged.current = false;
    tapped.current = false;
    dragging.current = painting;
    const index = cellIndexAt(event.clientX, event.clientY);
    startIndex.current = index;
    lastIndex.current = index;
    let captured = false;
    if (painting) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        captured = true;
      } catch {
        // Safari throws when the pointer is already captured elsewhere.
      }
    }
    if (!captured) {
      armWindowEnd();
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || event.pointerId !== strokePointer.current) {
      return;
    }

    const index = cellIndexAt(event.clientX, event.clientY);
    if (index === null || index === lastIndex.current) {
      return;
    }
    if (!dragged.current) {
      dragged.current = true;

      if (startIndex.current !== null) {
        onPaintOver(startIndex.current);
      }
    }
    lastIndex.current = index;
    onPaintOver(index);
  };

  const endDrag = () => {
    dragging.current = false;
    strokePointer.current = null;
    detachWindowEnd.current?.();
  };

  const endStroke = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== strokePointer.current) {
      return;
    }
    endDrag();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== strokePointer.current) {
      return;
    }
    const start = startIndex.current;
    const end = cellIndexAt(event.clientX, event.clientY);
    if (
      dragging.current &&
      !dragged.current &&
      start !== null &&
      end === start
    ) {
      tapped.current = true;
      onTap(start);
    }
    endDrag();
    if (end !== null) {
      onStrokeEnd?.(end);
    }
  };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: endStroke,
      onLostPointerCapture: endStroke,
    },
    consumedClick: (event) =>
      event.detail > 0 && (dragged.current || tapped.current),
  };
}

function cellIndexAt(x: number, y: number): number | null {
  const target = document.elementFromPoint(x, y);
  const cell = target?.closest("[data-cell-index]");
  const raw = cell?.getAttribute("data-cell-index");
  if (raw === null || raw === undefined) {
    return null;
  }
  const index = Number.parseInt(raw, 10);
  return Number.isInteger(index) ? index : null;
}
