import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { Press } from "./brush";
import {
  cellsAfter,
  projectOnLine,
  strokeAxis,
  type StrokeAxis,
} from "./straight-stroke";

interface PointerStrokeHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

export interface PointerStroke {
  readonly handlers: PointerStrokeHandlers;

  readonly clickPress: (event: { readonly detail: number }) => Press | null;
}

export function usePointerStroke(input: {
  readonly painting: boolean;
  readonly onTap: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;
  readonly onPaintOver: (index: number) => void;

  readonly onStrokeEnd?: (index: number) => void;
  readonly straight?: { readonly size: number };
}): PointerStroke {
  const { painting, onTap, onStrokeStart, onPaintOver, onStrokeEnd, straight } =
    input;

  const dragging = useRef(false);
  const dragged = useRef(false);

  const tapped = useRef(false);
  const press = useRef<Press>("tap");
  const startIndex = useRef<number | null>(null);
  const lastIndex = useRef<number | null>(null);
  const anchorAt = useRef({ x: 0, y: 0 });
  const axis = useRef<StrokeAxis | null>(null);
  const line = useRef(straight);

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

  const releaseContextNet = useRef<(() => void) | null>(null);
  const lapseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Windows fires `contextmenu` after mouseup at the element under the cursor,
  // so a right press released off the board would open the page menu.
  const armContextNet = () => {
    releaseContextNet.current?.();
    const swallow = (native: Event) => {
      native.preventDefault();
      releaseContextNet.current?.();
    };
    window.addEventListener("contextmenu", swallow, true);
    releaseContextNet.current = () => {
      clearTimeout(lapseTimer.current);
      window.removeEventListener("contextmenu", swallow, true);
      releaseContextNet.current = null;
    };
  };

  useEffect(
    () => () => {
      detachWindowEnd.current?.();
      releaseContextNet.current?.();
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const opened = pressOf(event);
    if (opened === null || strokePointer.current !== null) {
      return;
    }
    press.current = opened;
    if (opened === "right") {
      armContextNet();
    }
    strokePointer.current = event.pointerId;
    dragged.current = false;
    tapped.current = false;
    dragging.current = painting;
    const index = cellIndexAt(event.clientX, event.clientY);
    startIndex.current = index;
    lastIndex.current = index;
    anchorAt.current = { x: event.clientX, y: event.clientY };
    axis.current = null;
    line.current = straight;
    let captured = false;
    if (painting) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
        captured = true;
      } catch {
        // jsdom does not implement pointer capture, and a pen can release
        // before it is taken; capture is only an optimisation here.
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
    const from = startIndex.current;
    if (from === null) {
      startIndex.current = index;
      lastIndex.current = index;
      anchorAt.current = { x: event.clientX, y: event.clientY };
      dragged.current = true;
      onStrokeStart(index, press.current);
      return;
    }
    if (!dragged.current) {
      dragged.current = true;
      onStrokeStart(from, press.current);
    }
    const size = line.current?.size;
    if (size === undefined) {
      lastIndex.current = index;
      onPaintOver(index);
      return;
    }
    axis.current ??= strokeAxis(size, from, index, {
      x: event.clientX - anchorAt.current.x,
      y: event.clientY - anchorAt.current.y,
    });
    const target = projectOnLine(size, from, axis.current, index);
    const cells = cellsAfter(
      size,
      axis.current,
      lastIndex.current ?? from,
      target,
    );
    lastIndex.current = target;
    for (const cell of cells) {
      onPaintOver(cell);
    }
  };

  const endDrag = () => {
    dragging.current = false;
    strokePointer.current = null;
    detachWindowEnd.current?.();
    if (releaseContextNet.current !== null) {
      lapseTimer.current = setTimeout(() => releaseContextNet.current?.(), 0);
    }
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
    if (!dragged.current && start !== null && end === start) {
      tapped.current = true;
      onTap(start, press.current);
    }
    endDrag();
    const settled =
      line.current !== undefined && dragged.current ? lastIndex.current : end;
    if (settled !== null) {
      onStrokeEnd?.(settled);
    }
  };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: endStroke,
      onLostPointerCapture: endStroke,
      onContextMenu: (event) => event.preventDefault(),
    },
    clickPress: (event) => {
      if (event.detail === 0) {
        return "tap";
      }
      const consumed = dragged.current || tapped.current;
      dragged.current = false;
      tapped.current = false;
      return consumed ? null : press.current;
    },
  };
}

function pressOf(event: ReactPointerEvent<HTMLDivElement>): Press | null {
  if (event.button === 2) {
    return "right";
  }
  if (event.button !== 0) {
    return null;
  }
  return event.pointerType === "mouse" ? "left" : "tap";
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
