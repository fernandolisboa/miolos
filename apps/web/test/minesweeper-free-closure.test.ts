import { describe, expect, it, vi } from "vitest";

import { closureOf, routesReaching } from "./module-graph";

// ADR-0055: contended local 2633 ms × 4 → 15_000.
vi.setConfig({ testTimeout: 15_000 });

const FREE_ROUTE = "apps/web/app/modo-livre/campo-minado/page.tsx";

const FREE_MODULES = [
  "apps/web/src/free-play/minesweeper-store.ts",
  "apps/web/src/free-play/use-free-minesweeper.ts",
  "apps/web/src/free-play/minesweeper-size-form.tsx",
  "apps/web/src/minesweeper/free-messages.ts",
];

describe("the best times, the size form and their copy reach the free-play route only (T-WEB-S1052)", () => {
  it("no daily, archive or conclusion route reaches a free-only module", () => {
    expect(
      Object.fromEntries(
        FREE_MODULES.map((module) => [module, routesReaching(module)]),
      ),
    ).toEqual(
      Object.fromEntries(FREE_MODULES.map((module) => [module, [FREE_ROUTE]])),
    );
  });

  it("the daily route still reaches the shared moves and copy, so the check above means something", () => {
    const daily = closureOf("apps/web/app/campo-minado/page.tsx");

    expect(daily.has("apps/web/src/minesweeper/use-minesweeper.ts")).toBe(true);
    expect(daily.has("apps/web/src/minesweeper/messages.ts")).toBe(true);
    expect(daily.has("apps/web/src/free-play/catalog.ts")).toBe(false);
  });
});
