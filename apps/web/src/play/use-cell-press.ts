import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { pressOf, type Press } from "./brush";
import { cellIndexAt } from "./cell-index-at";

export type CellPress = Press | "middle";

const LONG_PRESS_MS = 350;
const TAP_SLOP_PX = 10;

export function cellPressOf(event: {
  readonly button: number;
  readonly pointerType: string;
}): CellPress | null {
  return event.button === 1 ? "middle" : pressOf(event);
}

interface ActivePress {
  readonly pointerId: number;
  readonly kind: CellPress;
  readonly index: number;
  readonly x: number;
  readonly y: number;
  both: boolean;
  longPressed: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export interface CellPressInput {
  readonly onActivate: (index: number) => void;
  readonly onMark: (index: number) => void;
  readonly onChord: (index: number) => void;
}

interface CellPressHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

const BOTH_BUTTONS = 3;

export function useCellPress(input: CellPressInput): {
  readonly handlers: CellPressHandlers;
} {
  const latest = useRef(input);
  const active = useRef<ActivePress | null>(null);

  useEffect(() => {
    latest.current = input;
  });
  useEffect(
    () => () => {
      clearTimeout(active.current?.timer);
    },
    [],
  );

  const settle = () => {
    clearTimeout(active.current?.timer);
    active.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const kind = cellPressOf(event);
    const index = cellIndexAt(event.clientX, event.clientY);
    if (kind === null || index === null || active.current !== null) {
      return;
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // jsdom has no pointer capture, and a pen can release before it is taken.
    }
    const press: ActivePress = {
      pointerId: event.pointerId,
      kind,
      index,
      x: event.clientX,
      y: event.clientY,
      both: (event.buttons & BOTH_BUTTONS) === BOTH_BUTTONS,
      longPressed: false,
      timer: undefined,
    };
    active.current = press;
    if (kind === "right") {
      latest.current.onMark(index);
    } else if (kind === "tap") {
      press.timer = setTimeout(() => {
        press.longPressed = true;
        latest.current.onMark(index);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = active.current;
    if (press?.pointerId !== event.pointerId) {
      return;
    }
    if ((event.buttons & BOTH_BUTTONS) === BOTH_BUTTONS) {
      press.both = true;
    }
    if (
      press.kind === "tap" &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP_PX
    ) {
      settle();
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = active.current;
    if (press?.pointerId !== event.pointerId) {
      return;
    }
    settle();
    const index = cellIndexAt(event.clientX, event.clientY);
    if (index === null || press.longPressed) {
      return;
    }
    if (press.both || press.kind === "middle") {
      latest.current.onChord(index);
    } else if (press.kind !== "right") {
      latest.current.onActivate(index);
    }
  };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: (event) => {
        if (active.current?.pointerId === event.pointerId) {
          settle();
        }
      },
      onContextMenu: (event) => {
        event.preventDefault();
      },
    },
  };
}
