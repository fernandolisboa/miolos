import { useEffect, type RefObject } from "react";

export function closesOnEscape(event: KeyboardEvent): boolean {
  return event.key === "Escape";
}

export function useDismiss(
  open: boolean,
  rootRef: RefObject<Element | null>,
  setOpen: (open: boolean) => void,
  closesOn: (event: KeyboardEvent) => boolean,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (closesOn(event)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef, setOpen, closesOn]);
}
