import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { pressOf, type Press } from "./brush";
import { capturePointer, cellIndexAt } from "./cell-index-at";
import { useContextMenuNet } from "./use-context-menu-net";

type PressKind = Press | "middle";

const LONG_PRESS_MS = 350;
const TAP_SLOP_PX = 10;

function cellPressOf(event: {
  readonly button: number;
  readonly pointerType: string;
}): PressKind | null {
  return event.button === 1 ? "middle" : pressOf(event);
}

interface ActivePress {
  readonly pointerId: number;
  readonly pointerType: string;
  readonly kind: PressKind;
  readonly x: number;
  readonly y: number;
  both: boolean;
  spent: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

interface CellPressInput {
  readonly onActivate: (index: number, press: Press) => void;
  readonly onMark: (index: number) => void;
  readonly onChord: (index: number) => void;
}

interface CellPressHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
}

export interface HeldPress {
  readonly index: number;
  readonly chord: boolean;
}

export interface CellPress {
  readonly handlers: CellPressHandlers;
  readonly held: HeldPress | null;
}

const BOTH_BUTTONS = 3;

function bothHeld(event: { readonly buttons: number }): boolean {
  return (event.buttons & BOTH_BUTTONS) === BOTH_BUTTONS;
}

function chords(press: ActivePress): boolean {
  return press.both || press.kind === "middle";
}

export function useCellPress(input: CellPressInput): CellPress {
  const latest = useRef(input);
  const active = useRef<ActivePress | null>(null);
  const [held, setHeld] = useState<HeldPress | null>(null);
  const armContextNet = useContextMenuNet();

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
    setHeld(null);
  };

  const spend = (press: ActivePress) => {
    clearTimeout(press.timer);
    press.spent = true;
    setHeld(null);
  };

  const hold = (press: ActivePress, index: number | null) => {
    if (press.kind === "right" && !press.both) {
      return;
    }
    const chord = chords(press);
    setHeld((current) =>
      index === null
        ? null
        : current?.index === index && current.chord === chord
          ? current
          : { index, chord },
    );
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const kind = cellPressOf(event);
    const index = cellIndexAt(event.clientX, event.clientY);
    if (
      active.current?.pointerId === event.pointerId ||
      (event.isPrimary && active.current?.pointerType === event.pointerType)
    ) {
      settle();
    }
    if (kind === null || index === null || active.current !== null) {
      return;
    }
    if (kind === "middle") {
      event.preventDefault();
    }
    capturePointer(event);
    const press: ActivePress = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      kind,
      x: event.clientX,
      y: event.clientY,
      both: bothHeld(event),
      spent: false,
      timer: undefined,
    };
    active.current = press;
    if (kind === "right" || press.both) {
      armContextNet();
    }
    hold(press, index);
    if (kind === "right") {
      latest.current.onMark(index);
    } else if (kind === "tap" && !press.both) {
      press.timer = setTimeout(() => {
        spend(press);
        latest.current.onMark(index);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = active.current;
    if (press?.pointerId !== event.pointerId || press.spent) {
      return;
    }
    if (
      press.kind === "tap" &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_SLOP_PX
    ) {
      settle();
      return;
    }
    const index = cellIndexAt(event.clientX, event.clientY);
    if (bothHeld(event)) {
      if (!press.both) {
        press.both = true;
        clearTimeout(press.timer);
        armContextNet();
      }
    } else if (press.both) {
      spend(press);
      if (index !== null) {
        latest.current.onChord(index);
      }
      return;
    }
    hold(press, index);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const press = active.current;
    if (press?.pointerId !== event.pointerId) {
      return;
    }
    settle();
    const index = cellIndexAt(event.clientX, event.clientY);
    if (index === null || press.spent) {
      return;
    }
    if (chords(press)) {
      latest.current.onChord(index);
    } else if (press.kind !== "right" && press.kind !== "middle") {
      latest.current.onActivate(index, press.kind);
    }
  };

  const release = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (active.current?.pointerId === event.pointerId) {
      settle();
    }
  };

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (event) => {
        event.preventDefault();
      },
    },
    held,
  };
}
