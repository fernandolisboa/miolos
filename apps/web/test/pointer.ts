import { vi } from "vitest";

export function installPointerStubs(): void {
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    writable: true,
    value: () => null,
  });

  for (const method of [
    "setPointerCapture",
    "releasePointerCapture",
  ] as const) {
    Object.defineProperty(Element.prototype, method, {
      configurable: true,
      writable: true,
      value: () => undefined,
    });
  }
}

export function stubElementFromPoint(container: HTMLElement): void {
  vi.spyOn(document, "elementFromPoint").mockImplementation((x: number) =>
    container.querySelector(`[data-cell-index="${x}"]`),
  );
}
