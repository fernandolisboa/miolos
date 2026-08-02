import { vi } from "vitest";

/**
 * The jsdom scaffolding a pointer-stroke test needs, in one place because the
 * machinery it serves is now shared (`src/play/use-pointer-stroke.ts`, plan
 * 020 §5.3/§19 TR-8).
 *
 * Hoisted verbatim out of `binairo-screen.test.tsx` in the same behaviour-free
 * commit as the hook, with the Binairo suite as the oracle. Leaving it there
 * would ask the second dragging board for a third copy of an environment
 * setup that is deliberately no longer per game.
 */

/**
 * Define what jsdom does not implement at all, so the stroke tests have
 * something to stub and to run against.
 *
 * `document.elementFromPoint` needs jsdom layout, which does not exist, so the
 * method is absent from the document and `vi.spyOn` has nothing to replace —
 * hence a real definition here that `stubElementFromPoint` can then spy on and
 * `restoreAllMocks` can put back.
 *
 * jsdom implements neither pointer capture nor the click retargeting a real
 * browser does under it. Stubbing the methods at least keeps the hook on the
 * path every browser takes instead of its `catch` branch; the retargeting
 * itself is NOT simulated, so the tap tests pin the HANDLER's logic (a paint
 * tap is resolved on `pointerup`, and the trailing click cannot double-apply
 * it) rather than the browser behaviour that makes it necessary — that half
 * was reproduced in Chrome.
 */
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

/**
 * `elementFromPoint` is the ONLY way to know which cell a pointer is over:
 * with pointer capture — and on touch generally — `pointerenter` never fires
 * on the cells being crossed (plan 017 §8.2). The stub maps clientX straight
 * to a cell index.
 */
export function stubElementFromPoint(container: HTMLElement): void {
  vi.spyOn(document, "elementFromPoint").mockImplementation((x: number) =>
    container.querySelector(`[data-cell-index="${x}"]`),
  );
}
