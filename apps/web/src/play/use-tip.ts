"use client";

import {
  useId,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";

import { closesOnEscape, useDismiss } from "./use-dismiss";

export function useTip<Root extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<Root>(null);
  const pressedBy = useRef<string | null>(null);

  useDismiss(open, rootRef, setOpen, closesOnEscape);

  const hover = (next: boolean) => (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pressedBy.current = null;
    setOpen(next);
  };

  return [
    open,
    tipId,
    {
      ref: rootRef,
      onPointerEnter: hover(true),
      onPointerLeave: hover(false),
    },
    {
      "aria-expanded": open,
      "aria-describedby": tipId,
      onMouseDown: (event: MouseEvent) => {
        event.preventDefault();
      },
      onPointerDown: (event: PointerEvent) => {
        pressedBy.current = event.pointerType;
      },
      onPointerCancel: () => {
        pressedBy.current = null;
      },
      onFocus: () => {
        if (pressedBy.current === null) setOpen(true);
      },
      onBlur: () => {
        pressedBy.current = null;
        setOpen(false);
      },
      onClick: () => {
        const mouse = pressedBy.current === "mouse";
        pressedBy.current = null;
        setOpen((was) => mouse || !was);
      },
    },
  ] as const;
}
