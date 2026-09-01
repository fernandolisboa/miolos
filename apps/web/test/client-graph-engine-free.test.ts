import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { closureOf, routesReaching } from "./module-graph";
import { withoutComments } from "./ts-source";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");
const DAY_STATE = "apps/web/src/play/day-state.ts";
const PLAY_RECORD = "apps/web/src/play/play-record.ts";
const ENGINE_PACKAGE = /["']@miolos\/games(?:\/[^"']*)?["']/;

function importsEngine(module: string): boolean {
  return ENGINE_PACKAGE.test(
    withoutComments(readFileSync(join(REPO_ROOT, module), "utf8")),
  );
}

describe("the shared play modules carry no game engine (T-WEB-S354)", () => {
  it("imports `@miolos/games` from nowhere either module can reach", () => {
    const union = new Set([...closureOf(DAY_STATE), ...closureOf(PLAY_RECORD)]);
    expect([...union].filter(importsEngine)).toEqual([]);
  });

  it("flags a module that does import the engine, so a green run above means something", () => {
    expect(importsEngine("apps/web/src/termo/state.ts")).toBe(true);
    expect(
      [...closureOf("apps/web/src/termo/state.ts")].filter(importsEngine),
    ).not.toEqual([]);
  });

  it("reaches `packages/core`, so losing workspace resolution cannot pass quietly", () => {
    expect(closureOf(DAY_STATE)).toContain("packages/core/src/day.ts");
  });
});

describe("what those modules are actually on, measured (T-WEB-S354)", () => {
  it("keeps `day-state.ts` off every archive and free-play route", () => {
    const leaked = routesReaching(DAY_STATE).filter(
      (route) => route.includes("/arquivo/") || route.includes("/modo-livre/"),
    );
    expect(leaked).toEqual([]);
  });

  it("puts `day-state.ts` on the hub and on all four boards and conclusions", () => {
    expect(routesReaching(DAY_STATE)).toEqual([
      "apps/web/app/binairo/concluido/page.tsx",
      "apps/web/app/binairo/page.tsx",
      "apps/web/app/nonogram/concluido/page.tsx",
      "apps/web/app/nonogram/page.tsx",
      "apps/web/app/page.tsx",
      "apps/web/app/sudoku/concluido/page.tsx",
      "apps/web/app/sudoku/page.tsx",
      "apps/web/app/termo/concluido/page.tsx",
      "apps/web/app/termo/page.tsx",
    ]);
  });

  it("puts `play-record.ts` on strictly more routes than `day-state.ts`", () => {
    const record = routesReaching(PLAY_RECORD);
    for (const route of routesReaching(DAY_STATE)) {
      expect(record).toContain(route);
    }
    expect(record.length).toBeGreaterThan(routesReaching(DAY_STATE).length);
  });
});
