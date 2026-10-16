export function cellIndexOf(
  element: Element | null | undefined,
): number | null {
  const raw = element
    ?.closest("[data-cell-index]")
    ?.getAttribute("data-cell-index");
  if (raw === null || raw === undefined) {
    return null;
  }
  const index = Number.parseInt(raw, 10);
  return Number.isInteger(index) ? index : null;
}

export function cellIndexAt(x: number, y: number): number | null {
  return cellIndexOf(document.elementFromPoint(x, y));
}

export function capturePointer(event: {
  readonly currentTarget: Element;
  readonly pointerId: number;
}): boolean {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
    return true;
  } catch {
    // jsdom does not implement pointer capture, and a pen can release before
    // it is taken; capture is only an optimisation.
    return false;
  }
}
