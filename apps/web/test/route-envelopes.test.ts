import { describe, expect, it } from "vitest";

import { closureOf, routesReaching } from "./module-graph";

const DAILY_ROUTE = "apps/web/src/play/daily-route.tsx";
const GAME_ROUTE = "apps/web/src/archive/game-route.tsx";
const SCREEN_MODULE = /\/src\/(binairo|sudoku|nonogram|termo)\//;
const ARCHIVE_SCREEN = /\/src\/archive\/.*-screen/;
const CONCLUSION = /\/src\/play\/conclusion-view\.tsx$/;

describe("the shared route envelopes are game-blind (T-WEB-S364)", () => {
  it.each([DAILY_ROUTE, GAME_ROUTE])(
    "%s carries no per-game screen, conclusion or archive screen",
    (envelope) => {
      const closure = [...closureOf(envelope)];

      expect({
        screens: closure.filter((path) => SCREEN_MODULE.test(path)),
        archiveScreens: closure.filter((path) => ARCHIVE_SCREEN.test(path)),
        conclusions: closure.filter((path) => CONCLUSION.test(path)),
      }).toEqual({ screens: [], archiveScreens: [], conclusions: [] });
    },
  );

  it("reaches exactly the 8 daily and conclusion routes", () => {
    expect(routesReaching(DAILY_ROUTE)).toEqual([
      "apps/web/app/binairo/concluido/page.tsx",
      "apps/web/app/binairo/page.tsx",
      "apps/web/app/nonogram/concluido/page.tsx",
      "apps/web/app/nonogram/page.tsx",
      "apps/web/app/sudoku/concluido/page.tsx",
      "apps/web/app/sudoku/page.tsx",
      "apps/web/app/termo/concluido/page.tsx",
      "apps/web/app/termo/page.tsx",
    ]);
  });

  it("reaches exactly the 4 archive play routes", () => {
    expect(routesReaching(GAME_ROUTE)).toEqual([
      "apps/web/app/arquivo/[data]/binairo/page.tsx",
      "apps/web/app/arquivo/[data]/nonogram/page.tsx",
      "apps/web/app/arquivo/[data]/sudoku/page.tsx",
      "apps/web/app/arquivo/[data]/termo/page.tsx",
    ]);
  });

  it("a control route does reach both its own screen and the envelope, so a green run above means something", () => {
    const closure = [...closureOf("apps/web/app/binairo/page.tsx")];

    expect(closure).toContain("apps/web/src/binairo/binairo-screen.tsx");
    expect(closure).toContain(DAILY_ROUTE);
  });
});
