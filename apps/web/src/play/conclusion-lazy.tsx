"use client";

import nextDynamic from "next/dynamic";

/**
 * The conclusion tree behind a `next/dynamic` boundary, for the four PLAY
 * screen roots only — ADR-0054 decision 15's recorded relief, taken up at
 * #145 step 7, the night it stopped being a forecast: #142 and #145 landed
 * together and `route-client-js.mjs` redded `/binairo` (+41.1) and
 * `/nonogram` (+43.2) against their 40 KB budgets, exactly as the script's
 * own forecast paragraph predicted ("one more conclusion-sized feature
 * reds `/nonogram`… the structural move is `next/dynamic`"). The
 * conclusion only renders after the grid closes, so it is a natural lazy
 * boundary: the play routes' first-load sets drop the whole tree.
 *
 * TWO RULES MAKE THIS SAFE:
 *
 * - `/<jogo>/concluido` pages and their per-game wrappers keep their
 *   STATIC imports of `conclusion-view` — that segment exists for a
 *   bookmark, a reload and `impeccable detect` (D26/D27), and its server
 *   render must keep carrying the real markup. Only the in-place swap on
 *   the play routes rides this module.
 * - every screen root calls `preloadConclusionView()` (or preloads its
 *   own wrapper module) in a mount effect, so the chunk downloads in the
 *   background while the player is still solving and the win-moment swap
 *   resolves from the module cache — no flash where the celebration goes.
 *   This is a code chunk, never puzzle content, so ADR-0004 is untouched.
 *
 * `ssr: false` changes nothing the play routes ever painted: a record is
 * localStorage and a claim is a client fetch, so no conclusion branch was
 * ever server-rendered on `/<jogo>`.
 */
export const ConclusionView = nextDynamic(
  async () => (await import("./conclusion-view")).ConclusionView,
  { ssr: false },
);

export const RemoteConclusionView = nextDynamic(
  async () => (await import("./conclusion-view")).RemoteConclusionView,
  { ssr: false },
);

export function preloadConclusionView(): void {
  void import("./conclusion-view");
}
